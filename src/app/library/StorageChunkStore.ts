/* tslint:disable */

import parallel from 'run-parallel';
import path from 'path';
import thunky from 'thunky';
import { File, IFile, FileEntry, FileWriter } from '@ionic-native/file/ngx';
import { WebtorrentService } from '../services/webtorrent/webtorrent.service';
import { FileManagerService } from '../services/webtorrent/file-manager.service';

interface Cache {
  buffer: Buffer;       // Buffer
  dataLength: number;   // Real data length of buffer.
  offset: number;       // Offset of file
  isFull: boolean;
}

export class StorageChunkStore {
  static webTorrentService: WebtorrentService = null;
  static file: File = null;
  static fileManager: FileManagerService = null;

  chunkLength: number;
  length: number;
  files = [];
  chunkMap = [];
  closed = false;
  lastChunkLength: number;
  lastChunkIndex: number;

  cacheList: Array<Cache> = [];
  isWritingFile = false;

  constructor(chunkLength, opts) {
    if (!opts) {
      opts = {};
    }

    this.chunkLength = Number(chunkLength);
    if (!this.chunkLength) {
      throw new Error('First argument must be a chunk length');
    }

    if (opts.files) {
      if (!Array.isArray(opts.files)) {
        throw new Error('`files` option must be an array');
      }
      this.files = opts.files.slice(0).map((file, i, files) => {
        if (file.path == null) {
          throw new Error('File is missing `path` property');
        }
        if (file.length == null) {
          throw new Error('File is missing `length` property');
        }
        if (file.offset == null) {
          if (i === 0) {
            file.offset = 0;
          } else {
            const prevFile = files[i - 1];
            file.offset = prevFile.offset + prevFile.length;
          }
        }
        if (file.path.indexOf('file:///') == -1) {
          file.path = file.path.replace('file:/', 'file:///');
        }
        if (file.path.startsWith(StorageChunkStore.fileManager.appDirectory)) {
          file.path = StorageChunkStore.fileManager.getDataDownloadFilePathSeedWeb(file.path);
        }
        return file;
      });
      this.length = this.files.reduce(function(sum, file) { return sum + file.length; }, 0);
      if (opts.length != null && opts.length !== this.length) {
        throw new Error('total `files` length is not equal to explicit `length` option');
      }
    } else {
      const len = Number(opts.length) || Infinity;
      this.files = [{
        offset: 0,
        path: opts.path,
        length: len
      }];
      this.length = len;
    }

    this.chunkMap = [];
    this.closed = false;

    this.files.forEach(async (file) => {
      file.open = thunky(async (cb) => {
        if (file.fileWriter == null) {
          const { fileEntry, fileWriter, nativeFile } = await StorageChunkStore.fileManager.openFile(file.path);
          file.nativeFile = nativeFile;
          file.fileWriter = fileWriter;
        }
        if (this.closed) {
          return cb(new Error('Storage is closed'));
        }
        cb(null, file);
      });

      file.safeWrite = (offset: number, buf: Buffer, cb: Function) => {
        try {
          if (this.isWritingFile) {
            this.addBufferToCache(buf, offset);
            cb && cb();
            return;
          }
          file.fileWriter.onwriteend = () => {
            this.isWritingFile = false;
            nextTick(() => this.processNextCache(), null);
            cb && cb();
          };
          file.fileWriter.seek(offset);
          const newBuf = buf.buffer.slice(0, buf.length);
          file.fileWriter.write(newBuf);
          file.nativeFile.size = Math.max(file.nativeFile.size, offset + buf.length);
          this.isWritingFile = true;
        } catch (e) {
//          console.log(`EEEEE in SafeWrite ${e.code} ${offset} ${buf.length}`);
        }
      };

      file.write = (offset: number, buf: Buffer, cb: Function) => {
        try {
          if (file.nativeFile.size < offset) {
            const fileSize = file.nativeFile.size;
            const blankBufLen = offset - fileSize;
            file.nativeFile.size = offset;
            this.isWritingFile = true;

            file.fileWriter.onwriteend = () => {
              this.isWritingFile = false;
              nextTick(() => this.processNextCache(), null);
            };
            file.fileWriter.writeBlank(fileSize, blankBufLen);
          }

          file.safeWrite(offset, buf, () => nextTick(cb, null));
        } catch (e) {
//          console.log(`EEEEE ${e.code} ${offset} ${buf.length}`);
        }
      };

      file.read = (offset: number, length: number, cb: Function) => {
        try {
          const { nativeFile } = file;
          nativeFile.start = offset;
          nativeFile.end = offset + length;

          const fileReader = new FileReader();
          fileReader.onloadend = (fileReaderRes) => {
            const { result } = fileReaderRes.target as any;
            nextTick(cb, null, new Buffer(result));
          };

          fileReader.readAsArrayBuffer(nativeFile);
        } catch (e) {
          console.log(`File read error: ${e.code}`);
          nextTick(() => file.read(offset, length, cb), null, null);
        }
      };

      file.verifyPieces = (pieceHashes: Array<string>, cb: Function) => {
        const piecesJson = JSON.stringify(pieceHashes);

        file.fileWriter.onwriteend = (result: string) => {
          nextTick(cb, null, result);
        };

        file.fileWriter.verifyPieces(piecesJson, this.chunkLength);
      };
    });

    // If the length is Infinity (i.e. a length was not specified) then the store will
    // automatically grow.

    if (this.length !== Infinity) {
      this.lastChunkLength = (this.length % this.chunkLength) || this.chunkLength;
      this.lastChunkIndex = Math.ceil(this.length / this.chunkLength) - 1;

      this.files.forEach((file) => {
        const fileStart = file.offset;
        const fileEnd = file.offset + file.length;

        const firstChunk = Math.floor(fileStart / this.chunkLength);
        const lastChunk = Math.floor((fileEnd - 1) / this.chunkLength);

        for (let p = firstChunk; p <= lastChunk; ++p) {
          const chunkStart = p * this.chunkLength;
          const chunkEnd = chunkStart + this.chunkLength;

          const from = (fileStart < chunkStart) ? 0 : fileStart - chunkStart;
          const to = (fileEnd > chunkEnd) ? this.chunkLength : fileEnd - chunkStart;
          const offset = (fileStart > chunkStart) ? 0 : chunkStart - fileStart;

          if (!this.chunkMap[p]) {
            this.chunkMap[p] = [];
          }

          this.chunkMap[p].push({
            from,
            to,
            offset,
            file
          });
        }
      });
    }
  }

  allocateNewCache(offset: number) {
    const maxBufLen = this.chunkLength * 10;
    const cache: Cache = {
      buffer: new Buffer(maxBufLen),
      dataLength: 0,
      offset,
      isFull: false
    };
    this.cacheList.push(cache);
    return cache;
  }

  addBufferToCache(newBuffer: Buffer, newOffset: number) {
    let isDone = false;

    this.cacheList.forEach((cache) => {
      if (isDone) {
        return;
      }

      const { buffer, dataLength, offset, isFull } = cache;
      if (!isFull
        && offset + dataLength == newOffset
        && dataLength + newBuffer.length < buffer.length) {
        buffer.set(newBuffer, dataLength);
        cache.dataLength += newBuffer.length;

        if (cache.dataLength + this.chunkLength > buffer.length) {
          cache.isFull = true;
        }
        isDone = true;
      }
    });

    if (isDone) {
      return;
    }

    const newCache = this.allocateNewCache(newOffset);
    newCache.buffer.set(newBuffer, 0);
    newCache.dataLength = newBuffer.length;
  }

  processNextCache() {
    if (this.cacheList.length == 0 || this.isWritingFile) {
      return;
    }

    const { buffer, dataLength, offset } = this.cacheList.splice(0, 1)[0];
    const subBuf = buffer.slice(0, dataLength);
    this.files[0].safeWrite(offset, subBuf, null);
  }

  /**
   * Called from Immediate Chunk Store, Write chunk to file
   * @param index Chunk Index
   * @param buf Buffer
   * @param cb Callback (error, value)
   */
  put(index, buf, cb) {
    if (typeof cb !== 'function') {
      cb = noop;
    }
    if (this.closed) {
      return nextTick(cb, new Error('Storage is closed'));
    }
    const isLastChunk = (index === this.lastChunkIndex);
    if (isLastChunk && buf.length !== this.lastChunkLength) {
      return nextTick(cb, new Error('Last chunk length must be ' + this.lastChunkLength));
    }
    if (!isLastChunk && buf.length !== this.chunkLength) {
      return nextTick(cb, new Error('Chunk length must be ' + this.chunkLength));
    }

    if (this.length === Infinity) {
      this.files[0].open(function(err, file) {
        if (err) {
          return cb(err);
        }
        file.write(index * this.chunkLength, buf, cb);
      });
    } else {
      const targets = this.chunkMap[index];
      if (!targets) {
        return nextTick(cb, new Error('no files matching the request range'));
      }
      const tasks = targets.map(function(target) {
        return function(cb) {
          target.file.open(function(err, file) {
            if (err) {
              return cb(err);
            }
            file.write(target.offset, buf.slice(target.from, target.to), cb);
          });
        };
      });
      parallel(tasks, cb);
    }
  }

  get(index, opts, cb) {
    if (typeof opts === 'function') {
      return this.get(index, null, opts);
    }
    if (this.closed) {
      return nextTick(cb, new Error('Storage is closed'));
    }
    const chunkLength = (index === this.lastChunkIndex)
      ? this.lastChunkLength
      : this.chunkLength;

    const rangeFrom = (opts && opts.offset) || 0;
    const rangeTo = (opts && opts.length) ? rangeFrom + opts.length : chunkLength;

    if (rangeFrom < 0 || rangeFrom < 0 || rangeTo > chunkLength) {
      return nextTick(cb, new Error('Invalid offset and/or length'));
    }

    if (this.length === Infinity) {
      if (rangeFrom === rangeTo) {
        return nextTick(cb, null, Buffer.alloc(0));
      }
      this.files[0].open(function(err, file) {
        if (err) {
          return cb(err);
        }
        const offset = (index * this.chunkLength) + rangeFrom;
        file.read(offset, rangeTo - rangeFrom, cb);
      });
    } else {
      let targets = this.chunkMap[index];
      if (!targets) {
        return nextTick(cb, new Error('no files matching the request range'));
      }
      if (opts) {
        targets = targets.filter(function(target) {
          return (target.to > rangeFrom && target.from < rangeTo);
        });
        if (targets.length === 0) {
          return nextTick(cb, new Error('no files matching the requested range'));
        }
      }
      if (rangeFrom === rangeTo) {
        return nextTick(cb, null, Buffer.alloc(0));
      }
      const tasks = targets.map(function(target) {
        return function(cb) {
          let from = target.from;
          let to = target.to;
          let offset = target.offset;

          if (opts) {
            if (to > rangeTo) {
              to = rangeTo;
            }
            if (from < rangeFrom) {
              offset += (rangeFrom - from);
              from = rangeFrom;
            }
          }

          target.file.open(function(err, file) {
            if (err) {
              return cb(err);
            }
            file.read(offset, to - from, cb);
          });
        };
      });

      parallel(tasks, function(err, buffers) {
        if (err) {
          return cb(err);
        }
        cb(null, Buffer.concat(buffers));
      });
    }
  }

  /**
   * Verify all Pieces using cordova-file-plugin
   * @param pieces Pieces of torrent file.
   * @param cb Callback function which returns verify result.
   */
  verifyPieces(pieceHashes, cb) {
    this.files[0].open((err, file) => {
      this.files [0].verifyPieces(pieceHashes, (error, result) => {
        nextTick(cb, error, result);
      });
    });
  }

  close(cb) {
    cb(null);
    return;
  }

  destroy(cb) {
    cb(null);
    return;
  }
}

export function nextTick(cb, err, val?) {
  process.nextTick(function() {
    if (cb) {
      cb(err, val);
    }
  });
}

function noop() { }

/* tslint:enable */
