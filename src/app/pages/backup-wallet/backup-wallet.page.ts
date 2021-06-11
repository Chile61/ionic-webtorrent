import { Component, OnInit } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { ProfileService } from 'src/app/services/ocore/profile.service';
import { StorageService } from 'src/app/services/ocore/storage.service';
import { APP_BACKUP_DIR } from 'src/app/library/Config';
import db from 'ocore/db.js';
import jsZip from 'jszip';
import async from 'async';
import crypto from 'crypto';
import conf from 'ocore/conf';

declare let window: any;

@Component({
  selector: 'app-backup-wallet',
  templateUrl: './backup-wallet.page.html',
  styleUrls: ['./backup-wallet.page.scss'],
})
export class BackupWalletPage implements OnInit {
  // FS variable
  bFsInitialized = false;
  // DLG variable
  isShow = false;
  seedWords = '';
  exporting = false;
  exportingError = '';
  zip;

  constructor(
    private profileService: ProfileService,
    private storageService: StorageService,
    private alertCtrl: AlertController,
  ) {
    this.zip = new jsZip();
  }

  ngOnInit() {
    this.seedWords = this.profileService.focusedClient.credentials.mnemonic;
  }

  onToggle() {
    this.isShow = !this.isShow;
  }

  onRemove() {
    this.profileService.focusedClient.clearMnemonic();
    this.profileService.clearMnemonic(() => {});
    this.seedWords = '';
  }

  init = (cb) => {
    if (this.bFsInitialized) {
      return cb(null);
    }

    const onFileSystemSuccess = (fileSystem) => {
      console.log('File system started: ', fileSystem.name, fileSystem.root.name);
      this.bFsInitialized = true;
      return cb(null);
    };

    const fail = (evt) => {
      const msg = 'Could not init file system: ' + evt.target.error.code;
      return cb(msg);
    };

    window.requestFileSystem(window.PERSISTENT, 0, onFileSystemSuccess, fail);
  }

  getDatabaseDirPath() {
    let parentDirPath = '', databaseDirName = '';
    switch (window.cordova.platformId) {
      case 'ios':
        parentDirPath = window.cordova.file.applicationStorageDirectory + '/Library';
        break;
      case 'android':
      default:
        parentDirPath = window.cordova.file.applicationStorageDirectory;
    }
    switch (window.cordova.platformId) {
      case 'ios':
        databaseDirName = 'LocalDatabase';
        break;
      case 'android':
      default:
        databaseDirName =  'databases';
    }
    return parentDirPath + '/' + databaseDirName;
  }

  readdir(path, cb) {
    this.init(() => {
      window.resolveLocalFileSystemURL(path, fileSystem => {
          const reader = fileSystem.createReader();
          reader.readEntries(
            (entries) => {
              cb(null, entries.map(entry => {
                return entry.name;
              }));
            },
            (err) => {
              cb(err);
            }
          );
        }, (err) => {
          cb(err);
        }
      );
    });
  }

  readFileFromForm(file, cb) {
    const reader: any = new FileReader();
    reader.onloadend = (evt) => {
      const fileBuffer = Buffer.from(new Uint8Array(reader.result));
      cb(null, fileBuffer);
    };
    reader.readAsArrayBuffer(file);
  }

  readFile(path, cb) {
    const _this = this;
    _this.init(() => {
      window.resolveLocalFileSystemURL(path, (fileEntry) => {
        fileEntry.file((file) => {
          _this.readFileFromForm(file, cb);
        });
      }, (e) => {
        throw new Error('error: ' + JSON.stringify(e));
      });
    });
  }

  listDBFiles(dbDirPath, cb) {
    this.readdir(dbDirPath, (err, listFilenames) => {
      if (err) {
        return cb(err);
      }
      listFilenames = listFilenames.filter((name) => {
        return (name === 'conf.json' || /\.sqlite/.test(name));
      });
      cb(null, listFilenames);
    });
  }

  addDBAndConfToZip = (cb) => {
    const _this = this;
    const dbDirPath = this.getDatabaseDirPath() + '/';
    this.listDBFiles(dbDirPath, (err, listFilenames) => {
      if (err) {
        return cb(err);
      }
      async.forEachSeries(listFilenames, (name, callback) => {
        _this.readFile(dbDirPath + '/' + name, (error, data) => {
          if (error) {
            return callback(error);
          }
          _this.zip.file(name, data);
          callback();
        });
      }, cb);
    });
  }

  writeByChunks(writer, data, handle) {
    let written = 0;
    const BLOCK_SIZE = 1 * 1024 * 1024; // write 1M every time of write
    const writeNext = (cbFinish) => {
      const chunkSize = Math.min(BLOCK_SIZE, data.byteLength - written);
      const dataChunk = data.slice(written, written + chunkSize);
      written += chunkSize;
      writer.onwrite = (evt) => {
        if (written < data.byteLength) {
          writeNext(cbFinish);
        } else {
          cbFinish(null);
        }
      };
      writer.write(dataChunk);
    };
    writeNext(handle);
  }

  _cordovaWriteFile(dirEntry, name, data, cb) {
    const _this = this;
    if (typeof data !== 'string') {
      data = data.buffer;
    }
    dirEntry.getFile(name, {create: true, exclusive: false}, (file) => {
      file.createWriter((writer) => {
        _this.writeByChunks(writer, data, cb);
      }, cb);
    }, cb);
  }

  encrypt(buffer, password) {
    password = Buffer.from(password);
    const cipher = crypto.createCipheriv('aes-256-ctr',
      crypto.pbkdf2Sync(password, '', 100000, 32, 'sha512'),
      crypto.createHash('sha1').update(password).digest().slice(0, 16));
    const arrChunks = [];
    const CHUNK_LENGTH = 2003;
    for (let offset = 0; offset < buffer.length; offset += CHUNK_LENGTH) {
      arrChunks.push(cipher.update(buffer.slice(offset, Math.min(offset + CHUNK_LENGTH, buffer.length)), 'utf8'));
    }
    arrChunks.push(cipher.final());
    const res = Buffer.concat(arrChunks);
    console.log('Encrypt Data', password, buffer);
    return res;
  }

  cordovaWriteFile(cordovaFile, path, fileName, data, cb) {
    const _this = this;
    this.init(() => {
      window.resolveLocalFileSystemURL(cordovaFile, (dirEntry) => {
        if (!path || path === '.' || path === '/') {
          _this._cordovaWriteFile(dirEntry, fileName, data, cb);
        } else {
          dirEntry.getDirectory(path, {create: true, exclusive: false}, (dirEntry1) => {
            _this._cordovaWriteFile(dirEntry1, fileName, data, cb);
          }, cb);
        }
      }, cb);
    });
  }

  async showError(txt) {
    this.exporting = false;
    this.exportingError = txt;
    const alert = await this.alertCtrl.create({
      header: 'Error',
      message: this.exportingError,
      buttons: ['OK'],
    });
    await alert.present();
  }

  saveFile(file, cb) {
    const _this = this;
    const date = new Date();
    const dateString = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate()
      + '-' + date.getHours() + '-' + date.getMinutes() + '-' + date.getSeconds();
    const backupFilename = 'ObyteBackup-' + dateString + '.encrypted';
    const isMobileIOs = window.cordova.platformId;
    this.cordovaWriteFile((isMobileIOs === 'ios' ?
      window.cordova.file.cacheDirectory : window.cordova.file.externalRootDirectory), APP_BACKUP_DIR, backupFilename, file, (err) => {
      const text = isMobileIOs === 'ios' ?
        'Now you have to send this file somewhere to restore from it later ("Save to Files", send to yourself using chat apps, etc.)'
        : 'File saved to /' + APP_BACKUP_DIR + '/' + backupFilename +
        '. You can now also send it somewhere using chat apps or email to have more copies of the backup';
      // navigator.notification.alert(text, function(){
      //   window.plugins.socialsharing.shareWithOptions({files: [(isMobile.iOS() ? window.cordova.file.cacheDirectory :
      // window.cordova.file.externalRootDirectory) + 'Obyte/'+ backupFilename]}, function(){}, function(){});
      // }, 'Backup done');
      cb(err);
    });
  }

  walletExportCordova = connection => {
    const _this = this;
    this.storageService.getProfile((err, profile) => {
      _this.zip.file('profile', JSON.stringify(profile));
      _this.zip.file('config', JSON.stringify(this.storageService.getConfig()));
      _this.zip.file('light', 'true');
      this.addDBAndConfToZip((err1) => {
        if (err1) {
          return _this.showError(err1);
        }
        const zipParams = {type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: {level: 9}};
        _this.zip.generateAsync(zipParams).then((zipFile) => {
          _this.saveFile(_this.encrypt(zipFile, this.seedWords), async (err2) => {
            connection.release();
            if (err2) {
              return _this.showError(err2);
            }
            _this.exporting = false;
            const alert = await _this.alertCtrl.create({
              header: 'Success',
              message: 'Backup Success',
              buttons: ['OK'],
            });
            await alert.present();
            // $timeout(function() {
            //   notification.success(gettextCatalog.getString('Success'),
            // gettextCatalog.getString('Export completed successfully', {}));
            // });
          });
        }, (err3) => {
          _this.showError(err3);
        });
      });
    });
  }

  walletExport = () => {
    const _this = this;
    this.exporting = true;
    db.takeConnectionFromPool((connection) => {
      _this.walletExportCordova(connection);
    });
  }
}
