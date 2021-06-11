import { Injectable } from '@angular/core';
import { NativeStorage } from '@ionic-native/native-storage/ngx';
import { FileTransfer } from '@ionic-native/file-transfer/ngx';
import { Toast } from '@ionic-native/toast/ngx';
import { VideoEditor } from '@ionic-native/video-editor/ngx';
import { File } from '@ionic-native/file/ngx';

import { FileAccountService } from '../file-account.service';
import { FileManagerService } from '../webtorrent/file-manager.service';
import { VideoItem, VideoStorageItem } from './video-item';
import { ImportYoutubeService } from './import-youtube.service';
import { WebtorrentService } from '../webtorrent/webtorrent.service';

@Injectable({
  providedIn: 'root'
})
export class ImportVideoService {
  videoItemList: Map<number, VideoItem> = new Map<number, VideoItem>();
  webTorrentService: WebtorrentService = null;

  constructor(
    public nativeStorage: NativeStorage,
    public file: File,
    public fileAccountService: FileAccountService,
    public fileManager: FileManagerService,
    public fileTransfer: FileTransfer,
    public toast: Toast,
    public videoEditor: VideoEditor,
    public importYoutubeService: ImportYoutubeService) {
    this.fileAccountService.importVideoService = this;
    this.importYoutubeService.importVideoService = this;
  }

  load() {
    this.restoreFromStorage();
  }

  async restoreFromStorage() {
    const videos: Array<VideoStorageItem> = await this.nativeStorage.getItem('importedVideos');

    if (videos === null || videos.length === 0) { return; }

    this.videoItemList.clear();
    videos.forEach((item: VideoStorageItem) => {
      this.openFile(item);
    });
    this.fileAccountService.onUpdateKeys();
  }

  async saveToStorage() {
    this.fileAccountService.onUpdateKeys();
    const videos: Array<VideoStorageItem> = [];
    this.videoItemList.forEach(item => videos.push(item.data));
    console.log('save   videos  ', videos);
    await this.nativeStorage.setItem('importedVideos', videos);
  }

  loadFromLink = async (link: string): Promise<HTMLVideoElement> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.setAttribute('src', link);
      video.onloadeddata = (event) => {
        resolve(video);
      };
      video.onerror = (error) => {
        console.log('Video import ERROR', link, error);
        video.remove();
        reject(error);
      };
    });
  }

  getMetaString = (video: HTMLVideoElement) => {
    const {
      videoHeight,
      videoWidth,
      duration } = video;

    return `${duration}s (${videoWidth}x${videoHeight})`;
  }

  getMetaInfo = (video: HTMLVideoElement) => {
    const {
      videoHeight,
      videoWidth,
      duration } = video;

    return {
      videoHeight,
      videoWidth,
      duration
    };
  }

  openFile(itemData: VideoStorageItem) {
    const videoItem: VideoItem = new VideoItem(null, this);
    videoItem.data = itemData;
    this.videoItemList.set(itemData.createdTime, videoItem);
    if (!videoItem.data.isDownloaded) {
      videoItem.startDownload();
    } else {
      videoItem.afterImport();
    }
  }

  /**
   * @param link Link for video url
   * @param metaInfo Meta data - {
   *  width, height, duration, qualityLabel?, title?, type?, videoUrl?, thumbnailUrl?, extName?, capacity?, description?
   * }
   */
  importVideoFromLink = (link: string, metaInfo: object) => {
    const oldItem = this.getItemByLink(link);
    if (oldItem) {
      return oldItem;
    }

    const videoItem: VideoItem = new VideoItem(null, this);
    videoItem.init(link, metaInfo);
    videoItem.startDownload();
    this.videoItemList.set(videoItem.data.createdTime, videoItem);
    this.saveToStorage();

    return videoItem;
  }

  getItemKeyList = (): Array<number> => {
    const webTorrentIterKeys = this.videoItemList.keys();
    return Array.from(webTorrentIterKeys);
  }

  getItemByKey = (key: number) => {
    return this.videoItemList.get(key);
  }

  getItemByLink = (link: string): VideoItem => {
    let itemKey = null;
    this.videoItemList.forEach((item, key) => {
      if (item.data.url === link) {
        itemKey = key;
      }
    });
    if (itemKey == null) {
      return null;
    }
    return this.videoItemList.get(itemKey);
  }

  destroy = async (key, isRemoveVideoFile = false) => {
    if (!this.videoItemList.has(key)) {
      return;
    }
    await this.videoItemList.get(key).destroy(isRemoveVideoFile);
    this.videoItemList.delete(key);
    this.saveToStorage();
  }

  createTorrent = (videoItem: VideoItem) => {
    this.webTorrentService.createTorrentFromVideoItem(videoItem);
  }
}
