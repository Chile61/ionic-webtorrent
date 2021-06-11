import { Injectable } from '@angular/core';
import { File, FileEntry, FileWriter } from '@ionic-native/file/ngx';
import { NativeStorage } from '@ionic-native/native-storage/ngx';
import { VideoEditor } from '@ionic-native/video-editor/ngx';
import WebTorrent from 'webtorrent';
import { TorrentItem, TorrentStorageItem } from './torrent-item';
import { AlertController } from '@ionic/angular';
import { FileManagerService } from './file-manager.service';
import { StorageChunkStore } from '../../library/StorageChunkStore';
import { HttpClient, HttpResponse } from '@angular/common/http';
import simpleGet from 'simple-get';
import { VERSION_PREFIX, PEER_ID_TYPE, SignalServerConfig } from 'src/app/library/Config';
import { ANNOUNCE_LIST, ANNOUNCE_LIST_ORIGINAL, ANNOUNCE_LIST_SEEDNET } from 'src/app/library/Config';
import { ProfileService } from '../ocore/profile.service';
import crypto from 'crypto';	// Needed for randomBytes
import { FileAccountService } from '../file-account.service';
import { VideoItem } from '../video/video-item';
import { showAlert } from 'src/app/library/Util';
import { ImportVideoService } from '../video/import-video.service';

@Injectable({
  providedIn: 'root'
})
export class WebtorrentService {
  client: WebTorrent.Instance;
  importVideoService: ImportVideoService = null;

  logList = [];
  torrentItemList: Map<number, TorrentItem> = new Map<number, TorrentItem>();
  onUpdate: () => void;

  constructor(
    public file: File,
    public alertCtrl: AlertController,
    public nativeStorage: NativeStorage,
    public videoEditor: VideoEditor,
    public fileManager: FileManagerService,
    public profileService: ProfileService,
    public fileAccountService: FileAccountService,
    public http: HttpClient
  ) {
    this.fileAccountService.webTorrentService = this;
  }

  init(peerIdType, isSeedNet = false) {
    let PEER_ID;

    if (peerIdType === PEER_ID_TYPE.PEER_ID_40) {
      // Create peer ID with length of 40 bytes including device id, "ST0102-012345678901234567890123456789012"
      const DEVICE_ID = this.profileService.profile.my_device_address;
      PEER_ID = Buffer.from(`${VERSION_PREFIX}${DEVICE_ID}`);
    } else {
      // Create standard peer ID with length of 20 bytes including RANDOM id, "-ST0102-012345678901"
      const EXTRA_MINUS = '-';
      const ID = crypto.randomBytes(9).toString('base64');
      PEER_ID = Buffer.from(`${EXTRA_MINUS}${VERSION_PREFIX}${ID}`);
    }
    const randomPort = this.randomInteger(1, 65535);
    this.client = new WebTorrent({
      peerId: PEER_ID,
      // @ts-ignore
      announceList: (peerIdType === PEER_ID_TYPE.PEER_ID_40 ? (isSeedNet ? ANNOUNCE_LIST_SEEDNET : ANNOUNCE_LIST) : ANNOUNCE_LIST_ORIGINAL),
      mobileFileSystem: true,
      peerId40: (peerIdType === PEER_ID_TYPE.PEER_ID_40 ? true : false),
      torrentPort: this.randomInteger(1, 65535),
      tracker: {
        rtcConfig: SignalServerConfig,
      },
    });
    this.client.on('error', (err: any) => {
      this.logList.push('Client error', err.toString());
      this.logList.push(err.stack);
    });

    StorageChunkStore.webTorrentService = this;
    StorageChunkStore.file = this.file;
    StorageChunkStore.fileManager = this.fileManager;

    simpleGet.concat = this.concat.bind(this);
  }

  load() {
    this.restoreFromStorage();
  }

  openFile(filePath: string | TorrentStorageItem): Promise<TorrentItem> {
    return new Promise((resolve, reject) => {
      const torrentItem = new TorrentItem(filePath, this.file, this, this.fileManager, this.alertCtrl, this.videoEditor, () => {
        if (!torrentItem.createdTime) { return reject(); }

        if (torrentItem.torrent) {
          const { infoHash } = torrentItem.torrent;
          if (infoHash && this.isDuplicated(infoHash)) {
            return reject();
          }
        }

        this.torrentItemList.set(torrentItem.createdTime, torrentItem);
        this.saveToStorage();
        resolve(torrentItem);
      }, (err) => {
        this.onError(err);
        reject(err);
      });
    });
  }

  async onError(err) {
    if (err === null) { return; }
    console.log(`ERROR  ${JSON.stringify(err)}`);

    let messageContent = err.message;
    switch (err.message) {
      case 'NOT_FOUND_ERR':
        messageContent = 'Can not find the file.';
        break;
    }
    const alert = await this.alertCtrl.create({
      header: 'Error',
      message: messageContent,
      buttons: ['Ok']
    });
    alert.present();
    this.saveToStorage();
  }

  async destroy(index: number, isRemoveTorrentFile: boolean = false, isRemoveVideo: boolean = false) {
    this.torrentItemList.get(index).destroy(isRemoveTorrentFile, isRemoveVideo);
    this.torrentItemList.delete(index);
    this.saveToStorage();
  }

  async destroyItem(torrentItem: TorrentItem) {
    const index = torrentItem.createdTime;
    this.torrentItemList.get(index).destroy();
    this.torrentItemList.delete(index);
    this.saveToStorage();
  }

  async saveToStorage() {
    this.fileAccountService.onUpdateKeys();
    const torrents: Array<TorrentStorageItem> = [];
    this.torrentItemList.forEach(item => torrents.push(item.storageItem));
    await this.nativeStorage.setItem('torrents', torrents);
  }

  async restoreFromStorage() {
    const torrents: Array<TorrentStorageItem> = await this.nativeStorage.getItem('torrents');
    this.logList.push(JSON.stringify(torrents));

    if (torrents === null || torrents.length === 0) { return; }

    this.torrentItemList.clear();
    torrents.forEach((item: TorrentStorageItem) => {
      this.openFile(item);
    });
  }

  resetPlayingStates() {
    this.torrentItemList.forEach(item => {
      item.isPlaying = false;
    });
  }

  resetToolbarStates() {
    this.torrentItemList.forEach(item => {
      item.isShowToolbar = false;
    });
  }

  concat(opts, cb) {
    try {
      let { method } = opts;
      const { url, headers, body, timeout } = opts;
      if (!method) { method = 'GET'; }

      this.http.request(method, url, {
        body,
        headers,
        observe: 'response',
        responseType: 'arraybuffer'
      }).subscribe((res: HttpResponse<ArrayBuffer>) => {
        const data = new Buffer(res.body);
        cb(null, {
          statusCode: res.status
        }, data);
      });
    } catch (e) {
      cb(e);
    }
  }

  isDuplicated(infoHash) {
    let isFound = false;
    this.torrentItemList.forEach(item => {
      if (item.torrent && item.torrent.infoHash === infoHash) {
        isFound = true;
      }
    });
    return isFound;
  }

  getItemKeyList = (): Array<number> => {
    const webTorrentIterKeys = this.torrentItemList.keys();
    return Array.from(webTorrentIterKeys);
  }

  randomInteger(min, max) {
    let result = 0;
    while (!result) {
      result = Math.floor(Math.random() * (max - min + 1)) + min;
    }
    return result;
  }

  async createTorrentFromVideoItem(videoItem: VideoItem) {
    try {
      const { videoFilePath, title } = videoItem.data;
      const torrentItem = await this.openFile(videoFilePath);
      this.importVideoService.destroy(videoItem.key, false);
      torrentItem.posterFilePath = videoItem.getPosterFilePath();
      torrentItem.title = title;
    } catch (e) {
      showAlert(this.alertCtrl, 'Can not create torrent object.');
    }
  }
}
