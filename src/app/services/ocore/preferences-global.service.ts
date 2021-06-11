import { Injectable } from '@angular/core';
import { OcoreConfigService } from './ocore-config.service';
import device from 'ocore/device.js';
import Mnemonic from 'bitcore-mnemonic';
import Bitcore from 'bitcore-lib';
import { NativeStorage } from '@ionic-native/native-storage/ngx';
import conf from 'ocore/conf.js';

@Injectable({
  providedIn: 'root'
})
export class PreferencesGlobalService {
  STORAGE_KEY = 'preferences';

  mnemonic;
  xPrivKey;
  xPubKey;

  unitName;
  bbUnitName;
  deviceName;
  myDeviceAddress;
  hub;
  currentLanguageName;
  torEnabled;

  constructor(
    public nativeStorage: NativeStorage,
    public config: OcoreConfigService
  ) {
    // this.initConfig();
  }
/*
  async initConfig() {
    var config = null;
    try {
      config = await this.nativeStorage.getItem(this.STORAGE_KEY);
    } catch (e) {
    }

    if (config === null) {
      config = {};
      config.mnemonic = new Mnemonic(Mnemonic.Words.ENGLISH).toString();
    }

    this.mnemonic = config.mnemonic;
    var code = new Mnemonic(this.mnemonic);
    this.xPrivKey = code.toHDPrivateKey();
    device.setDevicePrivateKey(this.xPrivKey.derive("m/1'").privateKey.bn.toBuffer({size: 32}));
    const currentWalletIndex = 0;
    this.xPubKey = Bitcore.HDPublicKey(this.xPrivKey.derive("m/44'/0'/" + currentWalletIndex + "'"));

    this.unitName = this.config.wallet.settings.unitName;
    this.bbUnitName = this.config.wallet.settings.bbUnitName;
    this.deviceName = this.config.getDeviceName();
    this.myDeviceAddress = device.getMyDeviceAddress();
    this.hub = this.config.hub;
    this.torEnabled = conf.socksHost && conf.socksPort;

    this.nativeStorage.setItem(this.STORAGE_KEY, config);
  }*/
}
