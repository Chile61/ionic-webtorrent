import { Component, OnInit } from '@angular/core';
import { LoadingController, AlertController } from '@ionic/angular';
import { Platform } from '@ionic/angular';
import { FileChooser } from '@ionic-native/file-chooser/ngx';
import { File } from '@ionic-native/file/ngx';
import { FilePath } from '@ionic-native/file-path/ngx';
import { StorageService } from 'src/app/services/ocore/storage.service';
import { Profile } from 'src/app/model/profile';
import db from 'ocore/db.js';
import jsZip from 'jszip';
import async from 'async';
import crypto from 'crypto';
import conf from 'ocore/conf';

declare let window: any;
declare let navigator: any;

@Component({
  selector: 'app-recover-wallet',
  templateUrl: './recover-wallet.page.html',
  styleUrls: ['./recover-wallet.page.scss'],
})
export class RecoverWalletPage implements OnInit {
  seedWords = ''; // now silly skirt core spirit soap combine describe robot primary reduce bless';
  loadingCtrl: HTMLIonLoadingElement;
  importing = false;
  error = '';
  bFsInitialized = false;
  zip;

  constructor(
    private loadingController: LoadingController,
    private alertController: AlertController,
    private storageService: StorageService,
    private fileChooser: FileChooser,
    private platform: Platform,
    private file: File,
    private filePath: FilePath,
  ) {
    this.zip = new jsZip();
  }

  ngOnInit() {
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
      console.log(msg);
      return cb(msg);
    };

    window.requestFileSystem(window.PERSISTENT, 0, onFileSystemSuccess, fail);
  }

  readFileFromForm(file, cb) {
    const reader: any = new FileReader();
    reader.onloadend = (evt) => {
      const fileBuffer = Buffer.from(new Uint8Array(reader.result));
      cb(null, fileBuffer);
    };
    reader.readAsArrayBuffer(file);
  }

  decrypt(buffer, password) {
    password = Buffer.from(password);
    const decipher = crypto.createDecipheriv('aes-256-ctr', crypto.pbkdf2Sync(password, '', 100000, 32, 'sha512'),
      crypto.createHash('sha1').update(password).digest().slice(0, 16));
    const arrChunks = [];
    const CHUNK_LENGTH = 2003;
    for (let offset = 0; offset < buffer.length; offset += CHUNK_LENGTH) {
      // @ts-ignore
      arrChunks.push(decipher.update(buffer.slice(offset, Math.min(offset + CHUNK_LENGTH, buffer.length)), 'utf8'));
    }
    arrChunks.push(decipher.final());
    const res = Buffer.concat(arrChunks);
    console.log('DecryptData', password, arrChunks);
    return res;
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

  deleteDirFiles(path, cb) {
    this.init(() => {
      window.resolveLocalFileSystemURL(path, (fileSystem) => {
          const reader = fileSystem.createReader();
          reader.readEntries((entries) => {
              async.forEach(entries, (entry, callback) => {
                if (entry.isFile) {
                  entry.remove(() => {
                    callback();
                  }, () => {
                    callback('failed to delete: ' + entry.name);
                  });
                } else {
                  callback(); // skip folders
                }
              }, (err) => {
                if (err) {
                  return cb(err);
                }
                cb();
              });
            }, (err) => {
              cb(err);
            }
          );
        }, (err) => {
          cb(err);
        }
      );
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

  writeDBAndFileStorageMobile(zip, cb) {
    const _this = this;
    const dbDirPath = this.getDatabaseDirPath() + '/';
    async.series([
      (next) => {
        db.close(() => {
          // remove old SQLite database
          _this.deleteDirFiles(dbDirPath, next);
        });
      },
      (next) => {
        // unzip files
        async.forEachOfSeries(zip.files, (objFile, key, callback) => {
          if (key === 'profile') {
            zip.file(key).async('string').then((data) => {
              _this.storageService.storeProfile(Profile.fromString(data), callback);
            });
          } else if (key === 'config') {
            zip.file(key).async('string').then((data) => {
              _this.storageService.storeConfig(data, callback);
            });
          } else if (/\.sqlite/.test(key)) {
            zip.file(key).async('nodebuffer').then((data) => {
              _this.cordovaWriteFile(dbDirPath, null, key, data, callback);
            });
          } else {
            callback();
          }
        }, next);
      }
    ], cb);
  }

  unzipAndWriteFiles(data, password) {
    const _this = this;
    this.zip.loadAsync(this.decrypt(data, password)).then((zip) => {
      if (!zip.file('light')) {
        this.importing = false;
        this.error = 'Mobile version supports only light wallets.';
      } else {
        _this.writeDBAndFileStorageMobile(zip, async (err) => {
          if (err) {
            return _this.showError(err);
          }
          _this.importing = false;
          if (_this.loadingCtrl) {
            _this.loadingCtrl.dismiss();
          }
          const alert = await _this.alertController.create({
            header: 'Success',
            message: 'Backup Success. Restart your app',
            buttons: [{
              text: 'OK',
              handler: () => {
                navigator.app.exitApp();
              }
            }],
          });
          await alert.present();
          // $rootScope.$emit('Local/ShowAlert', "Import successfully completed, please restart the application.", 'fi-check', function() {
          //   if (navigator && navigator.app)
          //     navigator.app.exitApp();
          //   else if (process.exit)
          //     process.exit();
          // });
        });
      }
    }, (err) => {
      _this.showError('Incorrect password or file');
    });
  }

  async onEnterWords() {
    // const result = this.recoverySeedService.recoveryForm(this.seedWords, () => {
    //   if (this.loadingCtrl) {
    //     this.loadingCtrl.dismiss();
    //   }
    //   this.presentAlert('Wallet is recovered successfully.\nPlease restart this app.', () => {
    //     (navigator as any).app.exitApp();
    //   });
    // }, () => {
    //   if (this.loadingCtrl) {
    //     this.loadingCtrl.dismiss();
    //   }
    //   this.presentAlert(this.recoverySeedService.error);
    // });

    // if (!result) {
    //   this.presentAlert(this.recoverySeedService.error);
    //   return;
    // }

    const _this = this;
    this.fileChooser.open()
      .then(uri => {
        this.filePath.resolveNativePath(uri)
        .then(resolvedFilePath => {
          _this.init(() => {
            window.resolveLocalFileSystemURL(resolvedFilePath, (fileEntry) => {
              fileEntry.file((file) => {
                _this.readFileFromForm(file, (err, data) => {
                  _this.unzipAndWriteFiles(data, _this.seedWords);
                });
              });
            });
          });
          // let path = resolvedFilePath.substring(0, resolvedFilePath.lastIndexOf('/'));
          // let file = resolvedFilePath.substring(resolvedFilePath.lastIndexOf('/')+1, resolvedFilePath.length);
          // this.file.readAsBinaryString(path, file)
          // .then(content => {
          //   _this.unzipAndWriteFiles(content, this.seedWords);
          // })
          // .catch(err => _this.showError(err));
        });
      })
      .catch(e => _this.showError(e));
    this.loadingCtrl = await this.loadingController.create({
      message: 'Please wait...',
    });
    this.loadingCtrl.present();
  }

  async presentAlert(message, cb = null) {
    const alert = await this.alertController.create({
      header: 'Alert',
      message,
      buttons: [{
        text: 'OK',
        role: 'cancel',
        cssClass: 'secondary',
        handler: (blah) => cb && cb()
      }]
    });

    await alert.present();
  }

  showError(txt) {
    if (this.loadingCtrl) {
      this.loadingCtrl.dismiss();
    }
    this.presentAlert(txt);
  }
}
