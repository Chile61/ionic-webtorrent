import path from 'path';
import { Injectable } from '@angular/core';
import { Toast } from '@ionic-native/toast/ngx';
import { FileOpener } from '@ionic-native/file-opener/ngx';
import { File, IFile, FileEntry } from '@ionic-native/file/ngx';
import { WebtorrentService } from '../webtorrent/webtorrent.service';
import { StorageService } from '../ocore/storage.service';
import { TorrentItem } from '../webtorrent/torrent-item';
import { FileManagerService } from '../webtorrent/file-manager.service';
import { FileChooserService } from '../webtorrent/file-chooser.service';

@Injectable({
  providedIn: 'root'
})
export class FileTransService {
  storageKey = 'FileTrans';
  completedKey = 'FileDownloaded';
  storageList: Map<number, object> = new Map<number, object>();     // Torrent Storage Object list for send file, not remove
  torrentList: Map<string, TorrentItem> = new Map<string, TorrentItem>();   // Download / Seed torrentItem list, remove after complete
  workingHashes: Array<string> = new Array<string>();               // Preparing to seed torrent item infoHash list, remove after start seed
  completedList: Array<string> = new Array<string>();               // Completed to receive torrent infoHash list, Not remove

  constructor(
    private webTorrentService: WebtorrentService,
    private fileManagerService: FileManagerService,
    private storageService: StorageService,
    private toast: Toast,
    private fileOpener: FileOpener,
    private file: File,
    private fileChooserService: FileChooserService
  ) { }

  async init() {
    this.storageList = await this.storageService.get(this.storageKey, {});
    this.completedList = await this.storageService.get(this.completedKey, []);
  }

  async save() {
    await this.storageService.set(this.storageKey, this.storageList);
    await this.storageService.set(this.completedKey, this.completedList);
  }

  async getStorageItem(infoHash) {
    return this.storageList[infoHash];
  }

  async prepareSendFile(filePath) {
    return;
/*
    const fileName = path.basename(filePath);
    const storageItem = await this.webTorrentService.openFileForChat(filePath);
    const { infoHash } = storageItem;
    storageItem.fileName = fileName;

    this.storageList[infoHash] = storageItem;
    await this.save();
    return storageItem;
*/
  }

  async seedFile({ infoHash }, onReadyFnc) {
/*
    if (!this.storageList[infoHash]) { return false; }
    const storageItem = this.storageList[infoHash];

    if (this.torrentList.get(infoHash)) { this.torrentList.get(infoHash).destroy(); }

    if (!this.workingHashes.includes(infoHash)) {
      this.workingHashes.push(infoHash);
      const torrentItem = await this.webTorrentService.openFile(storageItem, true);
      this.torrentList.set(infoHash, torrentItem);

      const index = this.workingHashes.indexOf(infoHash);
      if (index !== -1) { this.workingHashes.splice(index, 1); }

      torrentItem.onReadyFnc = () => onReadyFnc();
      return true;
    }
*/
    return false;
  }

  async onCompleteSend({ infoHash }) {
    const torrentItem = this.torrentList.get(infoHash);
    const { torrentName } = torrentItem;
    this.showToast(torrentName, infoHash, false);
    torrentItem.destroy();
    this.torrentList.delete(infoHash);
  }

  async receiveFile({ infoHash, magnetURI }, onCompleteFnc) {
/*
    const torrentItem = await this.webTorrentService.openFile(magnetURI, true);
    this.torrentList.set(infoHash, torrentItem);
    torrentItem.onTorrentDownloadDoneFnc = () => {
      const { torrentName } = torrentItem;
      // this.openDirectory(this.fileManagerService.getChatDestDirPath(), true);
      this.showToast(torrentName, infoHash, true);

      torrentItem.destroy();
      this.torrentList.delete(infoHash);
      onCompleteFnc();

      if (!this.isCompletedDownload(infoHash)) {
        this.completedList.push(infoHash);
      }
    };
*/
  }

  async cancelDownload({ infoHash }) {
    const torrentItem = this.torrentList.get(infoHash);
    torrentItem.destroy();
    this.torrentList.delete(infoHash);

    const index = this.workingHashes.indexOf(infoHash);
    if (index !== -1) { this.workingHashes.splice(index, 1); }
  }

  isTorrentExist({ infoHash }) {
    return !!this.torrentList.get(infoHash);
  }

  isCompletedDownload(infoHash) {
    return this.completedList.includes(infoHash);
  }

  showToast(torrentName, infoHash: string, bIncoming: boolean) {
    const fileDir = this.getTargetDir(infoHash, bIncoming);
    let message;

    if (bIncoming) {
      message = `${torrentName} is downloaded in ${fileDir}.`;
    } else {
      message = `${torrentName} is sent from ${fileDir}.`;
    }

    this.toast.show(message, '2000', 'bottom').subscribe();
  }

  getTargetDir(infoHash: string, bIncoming: boolean) {
    let fileDir = this.fileManagerService.getChatDestDirPath();

    if (!bIncoming) { fileDir = this.storageList[infoHash].videoFilePath; }

    fileDir = fileDir.replace('file:///', '/');

    return fileDir;
  }

  isFileExist(infoHash: string) {
    return !!this.storageList[infoHash];
  }

  openDirectory(infoHash: string, bIncoming: boolean) {
    const fileDir = this.getTargetDir(infoHash, bIncoming);

    (window as any).OurCodeWorld.Filebrowser.filePicker.single({
      startupPath: fileDir,
      success: async (data) => {
        if (!data.length) { return; }

        const uri = decodeURI(data[0]);
        const filePath = uri.replace(`content://${this.fileChooserService.packageName}.provider/root`, 'file://');
        this.openFileFromPath(filePath);
      }
    });
  }

  async openFile(messageEventData, bIncoming: boolean) {
    const { infoHash } = messageEventData;
    let filePath;
    if (!bIncoming) {
      filePath = this.storageList[infoHash].videoFilePath;
    } else {
      const { fileName } = messageEventData;
      const fileDir = this.fileManagerService.getChatDestDirPath();
      filePath = path.join(fileDir, fileName);
      filePath = filePath.replace('file:/', 'file:///');
    }

    this.openFileFromPath(filePath);
  }

  async openFileFromPath(filePath: string) {
    const mimeType = await this.getFileMimeType(filePath);

    this.fileOpener.open(filePath, mimeType)
      .then(() => console.log('File is opened'))
      .catch(e => console.log('Error opening file', e));
  }

  getFileMimeType(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.file.resolveLocalFilesystemUrl(filePath)
        .then((entry: FileEntry) => {
          return new Promise((_resolve, _reject) => {
            entry.file(meta => _resolve(meta), error => _reject(error));
          });
        })
        .then((meta: IFile) => {
          resolve(meta.type);
        });
    });
  }
}
