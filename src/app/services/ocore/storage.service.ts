import { Injectable } from '@angular/core';
import { NativeStorage } from '@ionic-native/native-storage/ngx';
import { Profile } from 'src/app/model/profile';
import { LogService } from '../log.service';

@Injectable({
  providedIn: 'root'
})
export class StorageService {

  constructor(
    public nativeStorage: NativeStorage,
    public log: LogService) { }

  async set(key: string, value: any, cb = null) {
    await this.nativeStorage.setItem(key, value);
    if (cb) {
      cb(null);
    }
  }

  async get(key: string, defaultValue: any = null, cb = null) {
    if (typeof defaultValue === 'function') {
      cb = defaultValue;
      defaultValue = null;
    }
    let value = defaultValue;
    try {
      value = await this.nativeStorage.getItem(key);
    } catch (e) {
    }
    if (cb) {
      cb(null, value);
    }
    return value;
  }

  async remove(key: string, cb = null) {
    await this.nativeStorage.remove(key);
    if (cb) {
      cb(null);
    }
  }

  async encryptOnMobile(text) {
    return text;
  }

  async decryptOnMobile(text) {
    return text;
  }

  async storeNewProfile(profile, cb = null) {
    const x = await this.encryptOnMobile(profile.toObj());
    await this.set('profile', x, cb);
  }

  async storeProfile(profile, cb = null) {
    const x = await this.encryptOnMobile(profile.toObj());
    await this.set('profile', x, cb);
  }

  async getProfile(cb): Promise<Profile> {
    let profile;
    profile = await this.get('profile', null);

    const result = await this.decryptOnMobile(profile);
    let p;
    try {
      p = Profile.fromString(result);
    } catch (e) {
      this.log.debug('Could not read profile:', e);
      if (cb) {
        cb(e);
      }
      return null;
    }
    if (cb) {
      cb(null, p);
    }

    return p;
  }

  deleteProfile(cb) {
    this.nativeStorage.remove('profile');
    if (cb) {
      cb();
    }
  }

  async storeFocusedWalletId(id, cb) {
    await this.set('focusedWalletId', id || '', cb);
  }

  getFocusedWalletId(cb) {
    this.get('focusedWalletId', cb);
  }

  setBackupFlag(walletId, cb) {
    this.set('backup-' + this.getSafeWalletId(walletId), Date.now(), cb);
  }

  getBackupFlag(walletId, cb) {
    this.get('backup-' + this.getSafeWalletId(walletId), cb);
  }

  clearBackupFlag(walletId, cb) {
    this.remove('backup-' + this.getSafeWalletId(walletId), cb);
  }

  async getConfig() {
    return await this.get('config', {});
  }

  async storeConfig(config, cb) {
    return await this.set('config', config, cb);
  }

  async removeConfig() {
    await this.nativeStorage.remove('config');
  }

  async setDisclaimerFlag(cb = null) {
    await this.set('agreeDisclaimer', true, cb);
  }

  async getDisclaimerFlag(cb) {
    await this.get('agreeDisclaimer', false, cb);
  }

  getSafeWalletId(walletId) {
    return walletId.replace(/[\/+=]/g, '');
  }

  setAddressbook(network, addressbook, cb) {
    this.set('addressbook-' + network, addressbook, cb);
  }

  getAddressbook(network, cb) {
    this.get('addressbook-' + network, cb);
  }

  removeAddressbook(network, cb) {
    this.remove('addressbook-' + network, cb);
  }
}
