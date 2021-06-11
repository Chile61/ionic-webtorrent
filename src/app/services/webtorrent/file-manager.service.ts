import path from 'path';
import { Injectable } from '@angular/core';
import { File, FileEntry, FileWriter, IFile, RemoveResult, DirectoryEntry } from '@ionic-native/file/ngx';
import { SeedNetCategories, SeedWebCategories, SeedMainDirectory, APP_DIR } from 'src/app/library/Config';
import { SEEDCHAT_DIR, SEEDNET_DIR, SEEDWEB_DIR, IMP_VIDEO_DIR } from 'src/app/library/Config';
import { AndroidPermissions } from '@ionic-native/android-permissions/ngx';
import { sleep } from 'src/app/library/Util';

export interface FileOpenData {
  fileEntry: FileEntry;
  fileWriter: FileWriter;
  nativeFile: IFile;
}

@Injectable({
  providedIn: 'root'
})

export class FileManagerService {
  appDir = APP_DIR;

  get appDirectory() { return `${this.file.externalRootDirectory}${this.appDir}`; }

  constructor(
    private androidPermissions: AndroidPermissions,
    public file: File
  ) {
    // this.init();
  }

  async init() {
    await this.askPermission();
    await this.createDirectory(this.appDirectory);

    for (const subMain of SeedMainDirectory) {
      const index = SeedMainDirectory.indexOf(subMain);
      const dir = this.getMainDirPath(index);
      await this.createDirectory(dir);
    }
/* disable SeedNet
    for (const category of SeedNetCategories) {
      const index = SeedNetCategories.indexOf(category);
      const dirSeedNet = this.getCatDirPathSeedNet(index);
      await this.createDirectory(dirSeedNet);

      const dirSeedChat = this.getCatDirPathSeedChat(index);
      await this.createDirectory(dirSeedChat);
    }
*/
    for (const category of SeedWebCategories) {
      const index = SeedWebCategories.indexOf(category);
      const dirSeedWeb = this.getCatDirPathSeedWeb(index);
      await this.createDirectory(dirSeedWeb);
    }

    await this.createDirectory(this.getImportedVideoDir());
  }

  askPermission() {
    return new Promise(async (resolve, reject) => {
      let hasPermission = false;
      while (!hasPermission) {
        try {
          ({ hasPermission } = await this.androidPermissions.checkPermission(this.androidPermissions.PERMISSION.WRITE_EXTERNAL_STORAGE));
        } catch (e) {}
        if (hasPermission) { break; }
        this.androidPermissions.requestPermissions([this.androidPermissions.PERMISSION.WRITE_EXTERNAL_STORAGE])
          .then(() => {})
          .catch(() => {});
        sleep(3000);
      }
      resolve(true);
    });
  }

  async createDirectory(directory): Promise<DirectoryEntry> {
    const dirName = path.dirname(directory);
    const baseName = path.basename(directory);
    return new Promise((resolve, reject) => {
      this.file.checkDir(dirName, baseName)
        .then(async _ => {
          const dirEntry = await this.file.resolveDirectoryUrl(directory);
          resolve(dirEntry);
        })
        .catch(async err => {
          const dirEntry = await this.file.createDir(dirName, baseName, true);
          resolve(dirEntry);
        });
    });
  }

  // SeedNet/{Category}
  getCatDirPathSeedNet(index: number) {
    const { title } = SeedNetCategories[index];
    return this.pathJoin(this.appDirectory, SEEDNET_DIR, title.toLowerCase());
  }

  // SeedChat/{Category}
  getCatDirPathSeedChat(index: number) {
    const { title } = SeedNetCategories[index];
    return this.pathJoin(this.appDirectory, SEEDCHAT_DIR, title.toLowerCase());
  }

  // SeedWeb/{Category}
  getCatDirPathSeedWeb(index: number) {
    const { title } = SeedWebCategories[index];
    return this.pathJoin(this.appDirectory, SEEDWEB_DIR, title.toLowerCase());
  }

  // SeedWallet/{subMain}
  getMainDirPath(index: number) {
    const { title } = SeedMainDirectory[index];
    return this.pathJoin(this.appDirectory, title);
  }

  // Entry for /SeedWeb/{Category}
  getCategoryDirEntrySeedWeb(index: number) {
    const dirPath = this.getCatDirPathSeedNet(index);
    return this.createDirectory(dirPath);
  }

  // SeedNet/{Category}/{torrentName}
  getDirPathSeedWeb(categoryIndex: number, torrentName: string) {
    const dirPath = this.getCatDirPathSeedWeb(categoryIndex);
    torrentName = this.extractName(torrentName);
    torrentName = this.removeFileExt(torrentName);
    return this.pathJoin(dirPath, torrentName);
  }

  // SeedWeb/{Category}/{torrentName}/{fileName}     SeedNet/category/bigbunny/bigbunny.mp4
  getDataFilePathSeedWeb(categoryIndex: number, torrentName: string, fileName: string = '') {
    if (fileName === '') {
      fileName = torrentName;
      torrentName = this.removeFileExt(fileName);
    }
    const dirPath = this.getDirPathSeedWeb(categoryIndex, torrentName);
    return this.pathJoin(dirPath, fileName);
  }

  // SeedWeb/{Category}/{torrentName}/{fileName}     SeedNet/category/bigbunny/bigbunny.mp4
  getDataDownloadFilePathSeedWeb(fileName) {
    const categoryIndex = this.getCategoryIndexSeedWeb(fileName);
    fileName = path.basename(fileName).trim();
    return this.getDataFilePathSeedWeb(categoryIndex, fileName);
  }

  // SeedWeb/{Category}/{torrentName}/{torrentName}.torrent     SeedNet/category/bigbunny/bigbunny.torrent
  getTorrentFilePathSeedWeb(categoryIndex: number, torrentName: string) {
    const dirPath = this.getDirPathSeedWeb(categoryIndex, torrentName);
    torrentName = this.removeFileExt(torrentName);
    return this.pathJoin(dirPath, `${torrentName}.torrent`);
  }

  // SeedWeb/{Category}/{torrentName}/{torrentName}.torrent     SeedNet/category/bigbunny/bigbunny.poster.jpg
  getPosterFilePathSeedWeb(categoryIndex: number, torrentName: string, ext: string = 'jpg') {
    torrentName = this.extractName(torrentName);
    const dirPath = this.getDirPathSeedWeb(categoryIndex, torrentName);
    return this.pathJoin(dirPath, `${torrentName}.poster.${ext}`);
  }

  // Entry for /SeedNet/{Category}
  getCategoryDirEntrySeedNet(index: number) {
    const dirPath = this.getCatDirPathSeedNet(index);
    return this.createDirectory(dirPath);
  }

  // SeedNet/{Category}/{torrentName}
  getDirPathSeedNet(categoryIndex: number, torrentName: string) {
    const dirPath = this.getCatDirPathSeedNet(categoryIndex);
    torrentName = this.extractName(torrentName);
    torrentName = this.removeFileExt(torrentName);
    return this.pathJoin(dirPath, torrentName);
  }

  // SeedNet/{Category}/{torrentName}/{fileName}     SeedNet/category/bigbunny/bigbunny.mp4
  getDataFilePathSeedNet(categoryIndex: number, torrentName: string, fileName: string = '') {
    if (fileName === '') {
      fileName = torrentName;
      torrentName = this.removeFileExt(fileName);
    }
    const dirPath = this.getDirPathSeedNet(categoryIndex, torrentName);
    return this.pathJoin(dirPath, fileName);
  }

  // SeedNet/{Category}/{torrentName}/{fileName}     SeedNet/category/bigbunny/bigbunny.mp4
  getDataDownloadFilePathSeedNet(fileName) {
    const categoryIndex = this.getCategoryIndexSeedNet(fileName);
    fileName = path.basename(fileName).trim();
    return this.getDataFilePathSeedNet(categoryIndex, fileName);
  }

  // SeedNet/{Category}/{torrentName}/{torrentName}.torrent     SeedNet/category/bigbunny/bigbunny.torrent
  getTorrentFilePathSeedNet(categoryIndex: number, torrentName: string) {
    const dirPath = this.getDirPathSeedNet(categoryIndex, torrentName);
    torrentName = this.removeFileExt(torrentName);
    return this.pathJoin(dirPath, `${torrentName}.torrent`);
  }

  // SeedNet/{Category}/{torrentName}/{torrentName}.torrent     SeedNet/category/bigbunny/bigbunny.poster.jpg
  getPosterFilePathSeedNet(categoryIndex: number, torrentName: string, ext: string = 'jpg') {
    torrentName = this.extractName(torrentName);
    const dirPath = this.getDirPathSeedNet(categoryIndex, torrentName);
    return this.pathJoin(dirPath, `${torrentName}.poster.${ext}`);
  }

  // SeedNet/Chat-filetransfer
  // storage/Download
  getChatDestDirPath() {
    return `${this.file.externalRootDirectory}Download`;
  }

  getChatDataDownloadFilePath(fileName) {
    const dirPath = this.getChatDestDirPath();
    fileName = path.basename(fileName).trim();
    return this.pathJoin(dirPath, fileName);
  }

  getCategoryIndexSeedNet(fileName: string) {
    let ext = path.extname(fileName);
    let categoryIndex = -1;
    ext = ext.substr(1, ext.length - 1);

    SeedNetCategories.forEach(({ exts }, index) => {
      if (exts.indexOf(ext) !== -1) {
        categoryIndex = index;
      }
    });

    return categoryIndex;
  }

  getCategoryIndexSeedWeb(fileName: string) {
    let ext = path.extname(fileName);
    let categoryIndex = -1;
    ext = ext.substr(1, ext.length - 1);

    SeedWebCategories.forEach(({ exts }, index) => {
      if (exts.indexOf(ext) !== -1) {
        categoryIndex = index;
      }
    });

    return categoryIndex;
  }

  getImportedVideoDir() {
    return this.pathJoin(this.appDirectory, IMP_VIDEO_DIR);
  }

  getImportedVideoPath(key) {
    const fileName = key;
    return this.pathJoin(this.getImportedVideoDir(), fileName);
  }

  getImportedVideoThumbnailPath(key) {
    const fileName = `${key}.jpg`;
    return this.pathJoin(this.getImportedVideoDir(), fileName);
  }

  removeFileExt(fileName: string) {
    const extSize = path.extname(fileName).length;
    return fileName.substr(0, fileName.length - extSize);
  }

  extractName(torrentName: string) {
    torrentName = path.basename(torrentName).trim();
    return this.removeFileExt(torrentName);
  }

  extractExtName(fileName: string) {
    return path.extname(fileName);
  }

  pathJoin(...paths: string[]) {
    let result = '';
    paths.forEach(pathStr => result += String(pathStr).trim() + path.sep);
    return result.substring(0, result.length - 1);
  }

  trimForDirs(filePath: string) {
    const dirs = filePath.split(path.sep);
    let newFilePath = '';
    dirs.forEach(dir => newFilePath = path.join(newFilePath, dir.trim()));
    return newFilePath.replace('file:/', 'file:///');
  }

  getFileEntrySize(fileEntry: FileEntry): Promise<number> {
    return new Promise((resolve, reject) => {
      fileEntry.getMetadata(metadata => resolve(metadata.size), error => {
        console.log(`File error: ${error.code}`);
        resolve(0);
      });
    });
  }

  createFileWriter(fileEntry: FileEntry): Promise<FileWriter> {
    return new Promise((resolve, reject) => {
      fileEntry.createWriter(fileWriter => resolve(fileWriter), error => {
        console.log(`File error: ${error.code}`);
        resolve(null);
      });
    });
  }

  openFile(filePath: string): Promise<FileOpenData> {
    return new Promise(async (resolve, reject) => {
      const fileDir = path.dirname(filePath);
      const fileDirEntry = await this.createDirectory(fileDir);
      const fileName = path.basename(filePath);

      const fileEntry = await this.file.getFile(fileDirEntry, fileName, { create: true });
      const fileWriter = await this.createFileWriter(fileEntry);

      fileEntry.file((file: IFile) => {
        resolve({
          fileEntry,
          fileWriter,
          nativeFile: file,
        });
      }, error => {
        console.log(`File error: ${error.code}`);
        reject(null);
      });
    });
  }

  removeFile(filePath: string): Promise<RemoveResult> {
    const dirName = path.dirname(filePath);
    const baseName = path.basename(filePath);
    return this.file.removeFile(dirName, baseName);
  }

  moveFile(orgFilePath: string, newFilePath: string) {
    const orgDirName = path.dirname(orgFilePath);
    const orgBaseName = path.basename(orgFilePath);
    const newDirName = path.dirname(newFilePath);
    const newBaseName = path.basename(newFilePath);
    return this.file.moveFile(orgDirName, orgBaseName, newDirName, newBaseName);
  }
}
