import { Injectable } from '@angular/core';
import { FileChooser } from '@ionic-native/file-chooser/ngx';
import { FilePath } from '@ionic-native/file-path/ngx';
import { NativeStorage } from '@ionic-native/native-storage/ngx';
import path from 'path';
import { Platform } from '@ionic/angular';
import { IMPORT_TYPES, IMPORT_SEEDWEB_FILETYPES, IMPORT_SEEDNET_FILETYPES, IMPORT_POSTER_FILETYPES } from 'src/app/library/Config';

declare let cordova: any;

@Injectable({
  providedIn: 'root'
})
export class FileChooserService {
  packageName: string;
  isOpenedFileChooser = false;
  fileChooserOptions;

  constructor(
    private platform: Platform,
    private nativeStorage: NativeStorage,
    private fileChooser: FileChooser,
    private filePath: FilePath,
  ) {
    this.platform.ready().then(() => {
      if (this.platform.is('mobile')) {
        (cordova as any).getAppVersion.getPackageName().then(packageName => this.packageName = packageName);
      }
    });
  }

  async getDefaultDir(): Promise<string> {
    try {
      return await this.nativeStorage.getItem('defaultDir');
    } catch (e) {
      return '';
    }
  }

  async saveDefaultDir(dir: string) {
    dir = dir.replace('file:///', '/');
    this.nativeStorage.setItem('defaultDir', dir);
  }

  open(importType = IMPORT_TYPES.SEEDWEB): Promise<string> {
    switch (importType) {
      case IMPORT_TYPES.SEEDNET:
        this.fileChooserOptions = { mime: IMPORT_SEEDNET_FILETYPES };
        break;
      case IMPORT_TYPES.POSTER:
        this.fileChooserOptions = { mime: IMPORT_POSTER_FILETYPES };
        break;
      default:
        this.fileChooserOptions = { mime: '' }; // IMPORT_SEEDWEB_FILETYPES };
        break;
    }

    if (this.platform.is('android')) {
      return this.openWithFileBrowser();
    } else {
      return this.openWithFileChooser();
    }
  }

  async openWithFileBrowser(): Promise<string> {
    return new Promise(async (resolve, reject) => {
      if (this.isOpenedFileChooser) { return; }
      this.isOpenedFileChooser = true;

      const defaultDir = await this.getDefaultDir();

      (window as any).OurCodeWorld.Filebrowser.filePicker.single({
        ...this.fileChooserOptions,
        startupPath: defaultDir,
        success: async (data) => {
          this.isOpenedFileChooser = false;
          if (!data.length) {
            return resolve(null);
          }

          const uri = decodeURI(data[0]);
          const filePath = uri.replace(`content://${this.packageName}.provider/root`, 'file://');
          const dir = path.dirname(filePath);
          this.saveDefaultDir(dir);
          resolve(filePath);
        },
        error(err) {
          this.isOpenedFileChooser = false;
          console.log(err);
          resolve(null);
        }
      });
    });
  }

  async openWithFileChooser(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.isOpenedFileChooser) { return; }
      this.isOpenedFileChooser = true;

      this.fileChooser.open(this.fileChooserOptions)
        .then(async uri => {
          const filePath = await this.contentUrlToFilePath(uri);
          resolve(filePath);
        })
        .catch(e => {
          console.log(e);
          resolve(null);
        }).finally(() => {
          this.isOpenedFileChooser = false;
        });
    });
  }

  contentUrlToFilePath(_path: string) {
    return this.filePath.resolveNativePath(_path);
  }
}
