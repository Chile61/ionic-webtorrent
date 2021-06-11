import { EventEmitter, Injectable } from '@angular/core';
import { ImportVideoService } from './video/import-video.service';
import { WebtorrentService } from './webtorrent/webtorrent.service';

export enum FileAccountType {
  Torrent = 1,
  ImportedVideo = 2
}

@Injectable({
  providedIn: 'root'
})
export class FileAccountService {
  keys: Array<number> = [];

  changedEvent: EventEmitter<boolean> = new EventEmitter();
  webTorrentService: WebtorrentService = null;
  importVideoService: ImportVideoService = null;

  constructor() {
    this.changedEvent.subscribe(() => {
      this.keys = this.getFileAccountKeys();
    });
  }

  load() {
    this.webTorrentService.load();
    this.importVideoService.load();
  }

  getFileAccountKeys = () => {
    const webTorrentKeys = this.webTorrentService ? this.webTorrentService.getItemKeyList() : [];
    const videoItemKeys = this.importVideoService ? this.importVideoService.getItemKeyList() : [];

    webTorrentKeys.push(...videoItemKeys);
    return webTorrentKeys.sort().reverse();
  }

  getFileAccountType = (key) => {
    const webTorrentKeys = this.webTorrentService ? this.webTorrentService.getItemKeyList() : [];
    const videoItemKeys = this.importVideoService ? this.importVideoService.getItemKeyList() : [];

    if (webTorrentKeys.indexOf(key) >= 0) {
      return FileAccountType.Torrent;
    }
    if (videoItemKeys.indexOf(key) >= 0) {
      return FileAccountType.ImportedVideo;
    }
  }

  get = (key) => {
    return this.webTorrentService.torrentItemList.get(key); // || this.importVideoService.videoItemList.get(key);
  }

  onUpdateKeys() {
    this.changedEvent.emit();
  }
}
