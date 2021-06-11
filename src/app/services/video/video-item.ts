import path from 'path';
import { FileTransfer, FileUploadOptions, FileTransferObject } from '@ionic-native/file-transfer/ngx';
import { Toast } from '@ionic-native/toast/ngx';
import { CreateThumbnailOptions, VideoEditor } from '@ionic-native/video-editor/ngx';

import { FileManagerService } from '../webtorrent/file-manager.service';
import { ImportVideoService } from './import-video.service';
import { SeedConfig } from 'src/app/pages/publish-config/publish-config.page';

export enum VideoType {
  Torrent = 0,
  Youtube,
  PureLink
}

export interface VideoStorageItem {
  url: string;
  title: string;
  videoFilePath: string;
  width: number;
  height: number;
  duration: number; // unit - s
  videoUrl: string; // For Youtube. same as url for pure video.
  isDownloaded: boolean;
  loaded?: number;
  capacity?: number;
  createdTime: number;
  type: VideoType;
  extName: string; // webm | mp4 | ...
  thumbnailUrl: string; // For Youtube. null for pure video
  thumbnailFilePath?: string;
  description?: string;
}

export class VideoItem {
  data: VideoStorageItem = null;

  fileManager: FileManagerService = null;
  transfer: FileTransfer = null;
  toast: Toast = null;
  videoEditor: VideoEditor = null;

  fileTransfer: FileTransferObject = null;
  posterDataURL = null;

  seedConfig: SeedConfig = null;

  constructor(
    data: VideoStorageItem,
    public importVideoService: ImportVideoService,
  ) {
    this.data = data;

    this.fileManager = importVideoService.fileManager;
    this.transfer = importVideoService.fileTransfer;
    this.toast = importVideoService.toast;
    this.videoEditor = importVideoService.videoEditor;
  }

  get key() {
    return this.data ? this.data.createdTime : 0;
  }

  get title() {
    return this.data.title;
  }

  get description() {
    return this.data.description;
  }

  get infoHash() {
    return '';
  }

  get duration() {
    return Math.floor(this.data.duration * 1000);
  }

  get resolution() {
    return this.data.width * this.data.height;
  }

  get torrentFilePath() {
    return null;
  }

  get torrent() {
    return {};
  }

  init(url: string, metaInfo: any) {
    this.data = {
      url,
      title: metaInfo.title || this.getVideoName(url),
      videoFilePath: null,
      width: metaInfo.width,
      height: metaInfo.height,
      duration: metaInfo.duration,
      videoUrl: metaInfo.videoUrl || url,
      createdTime: Date.now(),
      isDownloaded: false,
      type: metaInfo.type || VideoType.PureLink,
      thumbnailUrl: metaInfo.thumbnailUrl || null,
      extName: metaInfo.extName || this.fileManager.extractExtName(url),
      description: metaInfo.description || ''
    };
  }

  getVideoName = (url = null) => {
    if (this.data && this.data.title) {
      return this.data.title;
    }

    url = url || this.data.url;
    let videoName = '';
    if (url) {
      const m = url.toString().match(/.*\/(.+?)\./);
      if (m && m.length > 1) {
        videoName = m[1];
      }
    }
    videoName += path.extname(url);
    return videoName;
  }

  getTargetFilePath = () => {
    const videoFilePath = this.fileManager.getImportedVideoPath(this.data.createdTime);
    return `${videoFilePath}.${this.data.extName}`;
  }

  getPosterFilePath = () => {
    return this.data.thumbnailFilePath || this.fileManager.getImportedVideoThumbnailPath(this.data.createdTime);
  }

  getDownloadPercent = () => {
    const { loaded, capacity } = this.data;
    if (!capacity || !loaded) {
      return 0;
    }
    return loaded / capacity;
  }

  afterImport = () => {
    this.loadPosterDataURL();
  }

  startDownload = async () => {
    this.fileTransfer = this.transfer.create();
    const videoFilePath = this.getTargetFilePath();
    this.data.videoFilePath = videoFilePath;

    if (this.data.thumbnailUrl) {
      const thumbnailFilePath = await this.downloadThumbnail(this.data.thumbnailUrl);
      this.data.thumbnailFilePath = thumbnailFilePath;
    }

    this.importVideoService.saveToStorage();

    this.fileTransfer.download(this.data.videoUrl, videoFilePath).then(async (entry) => {
      this.fileTransfer = null;
      this.onAfterDownload(videoFilePath);
      // this.importVideoService.saveToStorage();
    }, (error) => {
      this.fileTransfer = null;
      console.log('Download Error', error);
      this.toast.show('Sorry, download is failed', '2000', 'bottom').subscribe();
    });

    this.fileTransfer.onProgress((progressEvent: ProgressEvent) => {
      const { loaded, total } = progressEvent;
      this.data.capacity = total;
      this.data.loaded = loaded;
    });
  }

  onAfterDownload = async (videoFilePath: string) => {
    this.data.isDownloaded = true;
    this.importVideoService.saveToStorage();

    const posterFilePath = this.getPosterFilePath();

    if (!this.data.thumbnailUrl) {
      const thumbnailOptions: CreateThumbnailOptions = {
        atTime: 1,
        quality: 50,
        fileUri: videoFilePath,
        width: this.data.width,
        height: this.data.height,
        outputFileName: this.key.toString()
      };
      let thumbnail = await this.videoEditor.createThumbnail(thumbnailOptions);
      thumbnail = `file://${thumbnail}`;
      await this.importVideoService.fileManager.moveFile(thumbnail, posterFilePath);
      await this.loadPosterDataURL();
    }
    this.importVideoService.createTorrent(this);
  }

  downloadThumbnail = (thumbnailUrl: string): Promise<string> => {
    const posterFilePath = this.getPosterFilePath();

    return new Promise((resolve, reject) => {
      let thumbFileTransfer = this.transfer.create();
      thumbFileTransfer.download(thumbnailUrl, posterFilePath).then(async (entry) => {
        thumbFileTransfer = null;
        await this.loadPosterDataURL();
        resolve(posterFilePath);
      }, async (error) => {
        thumbFileTransfer = null;
        console.log('Download Error', error);
        this.toast.show('Sorry, download thumbnail image is failed', '2000', 'bottom').subscribe();
        this.data.thumbnailUrl = null;
        resolve(null);
      });
    });
  }

  async savePoster(buf: Buffer) {
    const posterPath = this.getPosterFilePath();
    const { fileWriter } = await this.fileManager.openFile(posterPath);
    const arraybuffer = Uint8Array.from(buf).buffer;

    fileWriter.onwriteend = () => {
      this.data.thumbnailFilePath = posterPath;
      this.importVideoService.saveToStorage();
      this.loadPosterDataURL();
    };
    await fileWriter.write(arraybuffer);
  }

  async loadPosterDataURL() {
    const posterFilePath = this.getPosterFilePath();
    const fileDir = path.dirname(posterFilePath);
    const fileName = path.basename(posterFilePath);
    this.posterDataURL = await this.importVideoService.file.readAsDataURL(fileDir, fileName);
  }

  destroy = async (isRemoveVideoFile) => {
    if (isRemoveVideoFile) {
      const videoPath = this.getTargetFilePath();
      this.importVideoService.fileManager.removeFile(videoPath);

      const videoPosterPath = this.getPosterFilePath();
      this.importVideoService.fileManager.removeFile(videoPosterPath);
    }
    if (this.fileTransfer) {
      this.fileTransfer.abort();
    }
  }
}
