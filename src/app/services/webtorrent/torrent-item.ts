import { Torrent, TorrentFile } from 'webtorrent';
import parseTorrent, { remote as parseTorrentRemote, toTorrentFile as encodeTorrentFile } from 'parse-torrent';
import sha1 from 'simple-sha1';
import { File, IFile } from '@ionic-native/file/ngx';
import { CreateThumbnailOptions, VideoEditor, VideoInfo } from '@ionic-native/video-editor/ngx';
import path from 'path';
import { WebtorrentService } from './webtorrent.service';
import { AlertController } from '@ionic/angular';
import { StorageChunkStore } from '../../library/StorageChunkStore';
import { FileManagerService } from './file-manager.service';
import { ANNOUNCE_LIST, SEED_SECRET, SEED_KEY } from 'src/app/library/Config';
import { SeedConfig } from 'src/app/pages/publish-config/publish-config.page';
import { Decryptor } from 'strong-cryptor';

export interface TorrentStorageItem {
  title: string;
  torrentFilePath: string;
  videoFilePath: string;
  posterFilePath: string;
  isVerified: boolean;
  isPaused: boolean;
  createdTime: number;
  seedConfig: SeedConfig;
  videoInfo: VideoInfo;
}
export class TorrentItem {
  announceList = [];
  introData: string | TorrentStorageItem = null;
  _title: string = null;
  torrentFilePath: string = null;
  videoFilePath: string = null;
  posterFilePath: string = null;
  posterDataURL: string = null;
  videoInfo: VideoInfo = null;

  get torrentName() {
    if (this.torrent && this.torrent.name) {
      return this.fileManager.extractName(this.torrent.name);
    } else if (this.torrentFilePath) {
      return this.fileManager.extractName(this.torrentFilePath);
    } else if (this.videoFilePath) {
      return this.fileManager.extractName(this.videoFilePath);
    }
  }

  set title(newTitle) {
    this._title = newTitle;
    if (this.introData && typeof this.introData === 'object') {
      this.introData.title = newTitle;
    }
    this.webTorrentService.saveToStorage();
  }

  get title() {
    return this.torrentTitle;
  }

  get torrentTitle() {
    if (this._title) {
      return this._title;
    }
    if (this.introData && typeof this.introData === 'object' && this.introData.title) {
      return this.introData.title;
    }
    if (this.torrent && this.torrent.title) {
      return this.torrent.title;
    } else if (this.torrent && this.torrent.name) {
      return this.fileManager.extractName(this.torrent.name);
    } else if (this.torrentFilePath) {
      return this.fileManager.extractName(this.torrentFilePath);
    } else if (this.videoFilePath) {
      return this.fileManager.extractName(this.videoFilePath);
    }
  }

  get description() {
    return this.torrentComment;
  }

  get torrentComment() {
    if (this.torrent && this.torrent.comment) {
      return this.torrent.comment;
    }
    return '';
  }

  get infoHash() {
    return this.torrent.infoHash;
  }

  get duration() {
    return this.torrent.duration;
  }

  get resolution() {
    return this.torrent.resolution;
  }

  get categoryIndex() {
    return this.fileManager.getCategoryIndexSeedWeb(this.torrent.files[0].name);
  }

  get dataDownloadTargetPath() {
    const fileName = path.basename(this.torrent.files[0].name).trim();
    const filePath = this.fileManager.getDataFilePathSeedWeb(this.categoryIndex, fileName);
    return this.fileManager.trimForDirs(filePath);
  }

  get torrentDownloadTargetPath() {
    const filePath = this.fileManager.getTorrentFilePathSeedWeb(this.categoryIndex, this.torrentName);
    return this.fileManager.trimForDirs(filePath);
  }

  get posterDownloadTargetPath() {
    if (this.categoryIndex === -1) { return null; }
    const torrentName = this.torrent.name;
    const filePath = this.fileManager.getPosterFilePathSeedWeb(this.categoryIndex, torrentName);
    return this.fileManager.trimForDirs(filePath);
  }

  get storageItem(): TorrentStorageItem {
    return {
      title: this.title,
      torrentFilePath: this.torrentFilePath,
      videoFilePath: this.videoFilePath,
      posterFilePath: this.posterFilePath,
      isVerified: this.isSeeding,
      isPaused: this.isPaused,
      createdTime: this.createdTime,
      seedConfig: this.seedConfig,
      videoInfo: this.videoInfo
    };
  }

  get isPublished() {
    const { seedConfig } = this;
    if (!seedConfig || !seedConfig.walletAddress) {
      return false;
    }
    return true;
  }


  torrent: Torrent = null;
  seedConfig: SeedConfig = null;

  isReady = false;
  isSeeding = false;
  // isSeedReady = false;
  isPaused = false;
  isPlaying = false;
  isShowToolbar = false;
  createdTime = null;

  onReadyFnc: () => void;

  /**
   * @param introData torrent filePath / torrent file link / torrent magnet url / torrentStorageItem
   * @param file file
   * @param webTorrentService webTorrentService
   * @param fileManager fileManager
   * @param alertCtrl alertCtrl
   * @param videoEditor videoEditor
   * @param onSuccess onSuccess
   * @param onFailure onFailure
   */
  constructor(introData: string | TorrentStorageItem,
              public file: File,
              public webTorrentService: WebtorrentService,
              public fileManager: FileManagerService,
              public alertCtrl: AlertController,
              public videoEditor: VideoEditor,
              public onSuccess: any,
              public onFailure: any) {
    this.introData = introData;
    this.openFile(introData);
  }

  async openFile(introData: string | TorrentStorageItem) {
    this.torrent = null;
    this.isReady = false;
    this.isSeeding = false;
    this.isPaused = false;
    let filePath: string;
    let _isVerified = false;

    if (typeof introData === 'object') {
      const { torrentFilePath, videoFilePath, posterFilePath, isVerified } = introData;
      this.torrentFilePath = torrentFilePath;
      this.videoFilePath = videoFilePath;
      this.posterFilePath = posterFilePath;
      filePath = videoFilePath || torrentFilePath;
      _isVerified = this.isSeeding || isVerified;
      this.isPaused = introData.isPaused;
      this.createdTime = introData.createdTime;
      this.seedConfig = introData.seedConfig;
    } else {
      filePath = introData;
      this.createdTime = Date.now();
    }

    if (!filePath) {
      if (this.onFailure) {
        this.onFailure(null);
      }
      return;
    }

    // if (this.isPaused)

    try {
      if (this.isTorrentFile(filePath) || this.isTorrentLink(filePath) || this.isSTorrentFile(filePath) || this.isSTorrentLink(filePath)) {
        const { torrent, torrentInfo } = await this.openTorrentFile(filePath, _isVerified);
        this.torrent = torrent || torrentInfo;
        this.addEvents(this.torrent);

        if (this.isTorrentLink(filePath)) {
          this.torrentFilePath = filePath;
        } else if (this.isSTorrentLink(filePath)) {
          this.torrentFilePath = await this.copyTorrentFile(filePath, torrentInfo);
        } else if (this.isSTorrentFile(filePath)) {
          this.torrentFilePath = await this.copyTorrentFile(filePath, torrentInfo);
        } else if (!this.torrentFilePath) {
          this.torrentFilePath = await this.copyTorrentFile(filePath, torrentInfo);
        }
        if (this.onSuccess) {
          this.onSuccess();
        }
        this.onSuccess = null;
      } else {
        await this.seedVideoFile(filePath);
        if (this.onSuccess) {
          this.onSuccess();
        }
        this.onSuccess = null;
      }
    } catch (e) {
      this.onFailure(e);
    }
  }

  isTorrentFile(filePath: string) {
    return filePath.toLowerCase().endsWith('.torrent');
  }

  isTorrentLink(link: string) {
    return (link.toLowerCase().startsWith('http') && link.toLowerCase().endsWith('.torrent')); // || link.startsWith('magnet');
  }

  isSTorrentFile(filePath: string) {
    return filePath.toLowerCase().endsWith('.storrent');
  }

  isSTorrentLink(link: string) {
    return (link.toLowerCase().startsWith('http') && link.toLowerCase().endsWith('.storrent')); // || link.startsWith('magnet');
  }

  // file:///storage/emulated/0/Download/distel.torrent
  // https://webtorrent.io/torrents/sintel.torrent
  openTorrentFile(filePath: string, isVerified: boolean): Promise<any> {
    return new Promise(async (resolve, reject) => {
      try {
        let torrentInfo: any = null;

        if (this.isSTorrentLink(filePath)) {
          // STorrents need to be decrypted
          torrentInfo = await this.parseTorrent(filePath, true);
          try {
            const decryptor = new Decryptor({ key: SEED_KEY, encryptionCount: 1 });
            const newBuf = await decryptor.decrypt(torrentInfo.toString(), { toBuffer: true });
            const parsedTorrent = await parseTorrent(newBuf);
            if (parsedTorrent && parsedTorrent.infoHash) {
              torrentInfo = parsedTorrent;
            } else {
              torrentInfo = null;
            }
          } catch (e) {
            torrentInfo = null;
          }
        } else {
          torrentInfo = await this.parseTorrent(filePath, false);
        }

        if (torrentInfo === null || (torrentInfo.files && torrentInfo.files.length !== 1)) {
          return reject({ message: 'This torrent is corrupt or has none or more than one file.' });
        }

        const { announce } = torrentInfo;
        const torrentName = torrentInfo.name;
        const fileName = torrentInfo.files ? torrentInfo.files[0].name : torrentInfo.name;
        const categoryIndex = this.fileManager.getCategoryIndexSeedWeb(fileName);
        if (categoryIndex === -1) { return reject({ message: 'Unsupported file type.' }); }

        const dataPath = this.fileManager.getDirPathSeedWeb(categoryIndex, torrentName);
        this.webTorrentService.logList.push('Torrent for Add', JSON.stringify(announce));
        this.announceList.forEach(item => announce.indexOf(item) === -1 && announce.push(item));
        const options: any = {
          announce,
          path: dataPath,
          skipVerify: isVerified,
          store: StorageChunkStore,
          // isCordova: true,
        };
        // Poster
        this.loadPosterImage(torrentInfo);

        let torrent = null;
        if (!this.isPaused) {
          torrent = this.webTorrentService.client.add(torrentInfo, options);
        }

        resolve({
          torrent,
          torrentInfo
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  async hasPoster() {
    return this.posterFilePath && await this.isPosterExist(this.posterFilePath);
  }

  async loadPosterImage(torrentInfo) {
    console.log('Load Poster Image', this.posterFilePath);
    if (!this.posterFilePath || await this.isPosterExist(this.posterFilePath)) {
      const fileName = torrentInfo.files ? torrentInfo.files[0].name : torrentInfo.name;
      const categoryIndex = this.fileManager.getCategoryIndexSeedWeb(fileName);
      const posterFilePath = this.fileManager.getPosterFilePathSeedWeb(categoryIndex, torrentInfo.name);

      if (await this.isPosterExist(posterFilePath)) {
        this.posterFilePath = posterFilePath;
      }
    }
    await this.setPosterDataURL();
  }

  async parseTorrent(torrentFilePath: string, isSTorrent: boolean) {
    if (this.isTorrentLink(torrentFilePath) || this.isSTorrentLink(torrentFilePath)) {
      return new Promise((resolve, reject) => {
        parseTorrentRemote(torrentFilePath, isSTorrent, (err, torrent) => {
          if (err) { reject(err); } else { resolve(torrent); }
        });
      });
    } else {
      const directory = path.dirname(torrentFilePath);
      const fileName = path.basename(torrentFilePath);
      const arrayBuffer = await this.file.readAsArrayBuffer(directory, fileName);
      let buffer = new Buffer(arrayBuffer);

      if (this.isSTorrentFile(torrentFilePath)) {
        const decryptor = new Decryptor({ key: SEED_KEY, encryptionCount: 1 });
        buffer = await decryptor.decrypt(buffer.toString(), { toBuffer: true });
      }

      const res = await parseTorrent(buffer);
      return res;
    }
  }

  async getPieceList(files: Array<any>, pieceLength: number, cb) {
    const filePath = files[0].path;
    const { fileWriter } = await this.fileManager.openFile(filePath);
    const fileLength = fileWriter.length;

    (fileWriter as any).onwriteend = (pieces: string) => {
      cb(null, pieces, fileLength);
    };

    (fileWriter as any).getPieceList(pieceLength);
  }

  async seedVideoFile(videoFilePath: string) {
    this.isSeeding = true;
    this.videoFilePath = videoFilePath;

    let options: any = {};
    let torrentTitle: any = '';
    if (this.torrentFilePath) {
      const torrent: any = await this.parseTorrent(this.torrentFilePath, false);
      torrentTitle = torrent.title;
      const { announce } = torrent;
      this.announceList.forEach(item => announce.indexOf(item) === -1 && announce.push(item));
      this.webTorrentService.logList.push('Torrent for Seed', JSON.stringify(announce));

      options = {
        ...torrent,
        name: torrent.name,
        comment: torrent.comment,
        createdBy: torrent.createdBy,
        creationDate: torrent.creationDate,
        private: torrent.private,
        pieceLength: torrent.pieceLength,
        urlList: torrent.urlList,
        info: torrent.info,
        title: torrent.title,

        announce,
        skipVerify: true,
        // fileModtimes: file.lastModified
      };
    }

    const videoFileDir = path.dirname(videoFilePath);
    const videoFileName = path.basename(videoFilePath);
    const videoDirEntry = await this.fileManager.createDirectory(videoFileDir);
    const videoFileEntry = await this.file.getFile(videoDirEntry, videoFileName, { create: false });

    let videoInfo: any = await this.videoEditor.getVideoInfo({ fileUri: videoFilePath });
    const { duration, width, height, bitrate } = videoInfo;
    const resolution = height ? height : bitrate;
    const durationSec = Math.round(duration);
    videoInfo = { duration: durationSec, width, height, resolution, title: torrentTitle, secret: SEED_SECRET };
    const dataHash = sha1.sync(Buffer.from(JSON.stringify(videoInfo)));
    this.videoInfo = videoInfo;

    options = {
      ...options,
      store: StorageChunkStore,
      getPieceList: this.getPieceList.bind(this),
      path: videoFileDir,
      mobileFileSystem: true,
      announceList: ANNOUNCE_LIST,
      duration: durationSec,
      resolution,
      dataHash,
      //      title: torrentTitle,
    };

    videoFileEntry.file((file: IFile) => {
      options.file = file;
      try {
        this.torrent = this.webTorrentService.client.seed(videoFilePath, options, async (torrent) => {
          if (this.torrentFilePath === null) {
            this.torrentFilePath = await this.saveTorrentFile(torrent.name);
          }
          this.webTorrentService.saveToStorage();
          await this.loadPosterImage(torrent);
        });
        // @ts-ignore
        this.torrent.duration = Math.round(duration);
        // @ts-ignore
        this.torrent.resolution = resolution;
        // @ts-ignore
        this.torrent.dataHash = dataHash;
        // @ts-ignore
        this.torrent.title = torrentTitle;

        this.addEvents(this.torrent);
      } catch (err) {
        this.webTorrentService.logList.push('Seed Error: ', err.toString());
        throw err;
      }
    }, (err) => {
      console.log(err);
      this.webTorrentService.logList.push('onError: ', JSON.stringify(err));
      throw err;
    });

    return true;
  }

  pause() {
    if (this.isPaused) { return; }
    this.isPaused = true;

    this.torrent.destroy();
    this.webTorrentService.saveToStorage();
  }

  resume() {
    if (!this.isPaused) { return; }
    this.isPaused = false;

    if (typeof this.introData === 'object') {
      this.introData.isPaused = false;
    }
    this.openFile(this.introData);
    this.webTorrentService.saveToStorage();
  }

  destroy(isRemoveTorrentFile: boolean = false, isRemoveVideo: boolean = false) {
    if (isRemoveTorrentFile && this.torrentFilePath) {
      this.fileManager.removeFile(this.torrentFilePath);
    }

    if (isRemoveVideo) {
      let { videoFilePath } = this;
      if (!videoFilePath) {
        videoFilePath = this.dataDownloadTargetPath;
      }
      if (!videoFilePath) { return; }

      if (videoFilePath.startsWith(this.fileManager.appDirectory)) {
        this.fileManager.removeFile(videoFilePath);
      }
    }

    if (isRemoveVideo && this.posterFilePath) {
      this.fileManager.removeFile(this.posterFilePath);
    }

    if (isRemoveVideo) {
      const dir = this.fileManager.getDirPathSeedWeb(this.categoryIndex, this.torrentName);
      this.fileManager.removeFile(dir);
    }

    if (this.torrent && this.torrent.destroy) { this.torrent.destroy(); }

    this.createdTime = null;
  }

  getCategoryIndex(torrentInfo) {
    const fileName = torrentInfo.files ? torrentInfo.files[0].name : torrentInfo.name;
    return this.fileManager.getCategoryIndexSeedWeb(fileName);
  }

  async copyTorrentFile(torrentFilePath, torrentInfo) {
    let torrentName = torrentInfo.name;
    torrentName = this.fileManager.extractName(torrentName);
    const categoryIndex = this.getCategoryIndex(torrentInfo);

    const newTorrentPath = this.fileManager.getDirPathSeedWeb(categoryIndex, torrentName);
    const newTorrentFileName = `${torrentName}.torrent`;

    const oldTorrentPath = path.dirname(torrentFilePath);
    const oldTorrentFileName = path.basename(torrentFilePath);

    if (oldTorrentPath !== newTorrentPath
      || oldTorrentFileName !== newTorrentFileName) {
      if (this.isSTorrentLink(torrentFilePath) || this.isSTorrentFile(torrentFilePath)) {
        this.saveSTorrentFile(newTorrentPath, newTorrentFileName, torrentInfo);
      } else {
        this.file.copyFile(oldTorrentPath, oldTorrentFileName, newTorrentPath, newTorrentFileName);
      }
    }

    return this.fileManager.pathJoin(newTorrentPath, newTorrentFileName);
  }

  async saveTorrentFile(torrentName) {
    const { torrentFilePath } = this;
    if (!torrentName) { torrentName = this.torrent.name; }

    torrentName = this.fileManager.extractName(torrentName);

    const newTorrentPath = this.fileManager.getDirPathSeedWeb(this.categoryIndex, torrentName);
    const newTorrentFileName = `${torrentName}.torrent`;

    if (torrentFilePath) {
      const oldTorrentPath = path.dirname(torrentFilePath);
      const oldTorrentFileName = path.basename(torrentFilePath);

      if (oldTorrentPath !== newTorrentPath
        && oldTorrentFileName !== newTorrentFileName) {
        await this.file.copyFile(oldTorrentPath, oldTorrentFileName, newTorrentPath, newTorrentFileName);
      }
    } else if (this.torrent) {
      const blob = new Blob([this.torrent.torrentFile]);
      const torrentDirEntry = await this.fileManager.createDirectory(newTorrentPath);
      const fileEntry = await this.file.getFile(torrentDirEntry, newTorrentFileName, { create: true });
      const fileWriter = await this.fileManager.createFileWriter(fileEntry);
      fileWriter.truncate(0);
      fileWriter.write(blob);
    }
    this.webTorrentService.logList.push('Save torrent file', newTorrentPath, newTorrentFileName);
    return `${newTorrentPath}/${newTorrentFileName}`;
  }

  async saveSTorrentFile(newTorrentPath, newTorrentFileName, torrentInfo) {
    const newFilePath = `${newTorrentPath}/${newTorrentFileName}`;
    const newPosterPath = newFilePath.replace('torrent', 'poster.jpg');
    const { fileWriter } = await this.fileManager.openFile(newFilePath);
    const torrentBuf = await encodeTorrentFile(torrentInfo);
    const arraybuffer = Uint8Array.from(torrentBuf).buffer;

    const posterStr = torrentInfo.poster.toString('utf8') as string;
    const poster = Buffer.from(posterStr, 'base64');

    fileWriter.onwriteend = () => {
      this.webTorrentService.logList.push('Save storrent file', newTorrentPath, newTorrentFileName);
      return newFilePath;
    };
    fileWriter.write(arraybuffer);

    await this.savePosterFromTorrent(newPosterPath, poster);

    return null;
  }

  getDownloadPercent() {    // Return 0..1
    if (this.isSeeding) { return 1; }
    if (!this.isReady) { return 0; }

    return Math.round(this.torrent.downloaded / this.torrent.length * 100) / 100;
  }

  getDownloadSize() {
    if (this.isSeeding) { return this.torrent.length; }
    return this.torrent.downloaded;
  }

  addEvents(torrent: Torrent) {
    if (!torrent || !torrent.on) { return; }

    torrent.on('error', this.onError.bind(this));

    torrent.on('warning', this.onWarning.bind(this));

    torrent.on('infoHash', this.onInfoHash.bind(this));

    torrent.on('metadata', this.onMetaData.bind(this));

    torrent.on('ready', this.onReady.bind(this));

    torrent.on('noPeers', this.onNoPeers.bind(this));

    torrent.on('wire', this.onWire.bind(this));

    torrent.on('download', this.onDownload.bind(this));

    torrent.on('upload', this.onUpload.bind(this));

    torrent.on('done', this.onDone.bind(this));
  }

  async onError(err: string | Error) {
    // this.webTorrentService.logList.push("torrent onError: ", err.toString());

    const alert = await this.alertCtrl.create({
      header: 'Error',
      message: err.toString(),
      buttons: ['Ok']
    });
    alert.present();

    this.webTorrentService.destroyItem(this);
  }

  onWarning(err: string | Error) {
    // this.webTorrentService.logList.push("torrent onWarning: ", err.toString());
  }

  onInfoHash() {
    this.webTorrentService.logList.push('onInfoHash');
  }

  onMetaData() {
    this.webTorrentService.logList.push('onMetaData');
  }

  onReady() {
    this.webTorrentService.logList.push('onReady');
    if (this.onReadyFnc) {
      this.onReadyFnc();
    }
    this.isReady = true;
    if (this.isPaused) {
      this.torrent.destroy();
    }
  }

  onNoPeers(announceType: 'tracker' | 'dht') { }

  onWire(wire, addr?: string) {
    this.webTorrentService.logList.push('onWire', addr);
  }

  onDownload(bytes: number) {
    // this.webTorrentService.logList.push(`download  ${bytes}`);
  }

  onUpload(bytes: number) {
    // this.webTorrentService.logList.push(`upload  ${bytes}`);
  }

  onDone() {
    // console.log(new Error().stack)
    this.webTorrentService.logList.push(`DONE`);
    if (!this.isSeeding) {  // Complete torrent file.
      this.isSeeding = true;
      this.videoFilePath = this.dataDownloadTargetPath;
      this.webTorrentService.saveToStorage();
    }
  }

  async setPosterDataURL() {
    const { posterFilePath } = this;

    const fileDir = path.dirname(posterFilePath);
    const fileName = path.basename(posterFilePath);
    this.posterDataURL = await this.file.readAsDataURL(fileDir, fileName);
  }

  async isPosterExist(_posterPath: string = null) {
    const posterPath = _posterPath || this.posterDownloadTargetPath;
    if (posterPath === null) { return; }
    const { fileWriter } = await this.fileManager.openFile(posterPath);
    return fileWriter.length !== 0;
  }

  async savePoster(buf: Buffer) {
    const posterPath = this.posterDownloadTargetPath;
    const { fileWriter } = await this.fileManager.openFile(posterPath);
    const arraybuffer = Uint8Array.from(buf).buffer;

    fileWriter.onwriteend = () => {
      this.posterFilePath = posterPath;
      this.setPosterDataURL();
    };
    await fileWriter.write(arraybuffer);
  }

  async savePosterFromTorrent(posterPath: string, buf: any) {
    const { fileWriter } = await this.fileManager.openFile(posterPath);
    const arraybuffer = Uint8Array.from(buf).buffer;

    fileWriter.onwriteend = () => {
      this.posterFilePath = posterPath;
      this.setPosterDataURL();
    };
    await fileWriter.write(arraybuffer);
  }

  async createPosterFromVideoFile() {
    if (!this.videoFilePath) {
      return;
    }
    let videoInfo: VideoInfo = this.videoInfo;
    if (!videoInfo) {
      videoInfo = await this.videoEditor.getVideoInfo({ fileUri: this.videoFilePath });
      this.videoInfo = videoInfo;
    }
    const { width, height } = videoInfo;

    const thumbnailOptions: CreateThumbnailOptions = {
      atTime: 1,
      quality: 50,
      fileUri: this.videoFilePath,
      width,
      height,
      outputFileName: this.createdTime.toString()
    };
    let thumbnail = await this.videoEditor.createThumbnail(thumbnailOptions);
    thumbnail = `file://${thumbnail}`;
    const posterFilePath = this.posterDownloadTargetPath;
    await this.fileManager.moveFile(thumbnail, posterFilePath);
    this.posterFilePath = posterFilePath;
    this.setPosterDataURL();
  }
}
