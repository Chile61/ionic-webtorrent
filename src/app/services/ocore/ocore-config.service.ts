import { Injectable } from '@angular/core';
import lodash from 'lodash';
import { StorageService } from './storage.service';
import { LogService } from '../log.service';
import constants from 'ocore/constants.js';
import { HUB_DOMAIN_FULL } from 'src/app/library/Config';

@Injectable({
  providedIn: 'root'
})
export class OcoreConfigService {

  colorOpts = [
    '#DD4B39',
    '#F38F12',
    '#FAA77F',
    '#FADA58',
    '#9EDD72',
    '#77DADA',
    '#4A90E2',
    '#484ED3',
    '#9B59B6',
    '#E856EF',
    '#FF599E',
    '#7A8C9E',
  ];

  defaultConfig = {
    // wallet limits
    limits: {
      totalCosigners: 6
    },

    hub: HUB_DOMAIN_FULL,

    attestorAddresses: {
      email: 'H5EZTQE7ABFH27AUDTQFMZIALANK6RBG',
      reddit: 'OYW2XTDKSNKGSEZ27LMGNOPJSYIXHBHC',
      steem: 'JEDZYC2HMGDBIDQKG3XSTXUSHMCBK725',
      username: 'UENJPVZ7HVHM6QGVGT6MWOJGGRTUTJXQ'
    },

    realNameAttestorAddresses: [
      { address: 'I2ADHGP4HL6J37NQAD73J7E5SKFIXJOT', name: 'Real name attestation bot (Jumio)' },
      { address: 'OHVQ2R5B6TUR5U7WJNYLP3FIOSR7VCED', name: 'Real name attestation bot (Smart card, Mobile ID, Smart ID)' }
    ],

    // wallet default config
    wallet: {
      requiredCosigners: 2,
      totalCosigners: 3,
      spendUnconfirmed: false,
      reconnectDelay: 5000,
      idleDurationMin: 4,
      singleAddress: false,
      settings: {
        unitName: 'GSC',
        unitValue: 1000000000,
        unitDecimals: 9,
        unitCode: 'giga',
        bbUnitName: 'GBbytes',
        bbUnitValue: 1000000000,
        bbUnitDecimals: 9,
        bbUnitCode: 'giga',
        alternativeName: 'US Dollar',
        alternativeIsoCode: 'USD',
      },
    },

    // hidden assets: key = wallet id, value = set of assets (string: boolean)
    hiddenAssets: {},

    rates: {
      url: 'https://insight.bitpay.com:443/api/rates',
    },

    pushNotifications: {
      enabled: true,
      config: {
        android: {
          icon: 'push',
          iconColor: '#2F4053'
        },
        ios: {
          alert: 'true',
          badge: 'true',
          sound: 'true',
        },
        windows: {},
      }
    },

    autoUpdateWitnessesList: true
  };

  configCache = null;

  isTestnet;
  TIMESTAMPER_ADDRESS;
  backupExceedingAmountUSD = 10;

  privateTextcoinExt = 'coin';

  constructor(
    public storageService: StorageService,
    public log: LogService
  ) {
    this.isTestnet = constants.version.match(/t$/);
    this.TIMESTAMPER_ADDRESS = this.isTestnet ? 'OPNUXBRSSQQGHKQNEPD2GLWQYEUY5XLD' : 'I2ADHGP4HL6J37NQAD73J7E5SKFIXJOT';
  }

  initConfig(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any).config) {
        this.configCache = this.migrateLocalConfig((window as any).config);
        resolve();
      } else {
        this.get((error, config) => {
          this.configCache = config;
          resolve();
        });
      }
    });
  }

  getDeviceName = () => (window as any).device.name;

  getSync() {
    if (!this.configCache) {
      throw new Error('configService#getSync called when cache is not initialized');
    }
    return this.configCache;
  }

  async get(cb = null) {
    const localConfig = await this.storageService.getConfig();
    const configCache = this.migrateLocalConfig(localConfig);
    this.log.debug('Preferences read:', configCache);
    if (cb) {
      cb(null, configCache);
    }
    return configCache;
  }

  async set(newOpts, cb) {
    let config = this.defaultConfig;
    let oldOpts = await this.storageService.getConfig();
    if (lodash.isString(oldOpts)) {
      oldOpts = JSON.parse(oldOpts);
    }
    if (lodash.isString(config)) {
      config = JSON.parse(config as any);
    }
    if (lodash.isString(newOpts)) {
      newOpts = JSON.parse(newOpts);
    }
    lodash.merge(config, oldOpts, newOpts);
    if (newOpts.realNameAttestorAddresses) {
      config.realNameAttestorAddresses = newOpts.realNameAttestorAddresses;
    }
    this.checkAndReplaceOldUnitCode(config.wallet.settings);
    this.configCache = config;

    await this.storageService.storeConfig(config, cb);
  }


  async reset() {
    this.configCache = lodash.clone(this.defaultConfig);
    await this.storageService.removeConfig();
  }

  getDefaults() {
    return lodash.clone(this.defaultConfig);
  }

  migrateLocalConfig(localConfig) {
    let _config;
    if (localConfig) {
      _config = localConfig;
      if (typeof localConfig === 'string') {
        _config = JSON.parse(localConfig);
      }

      // these ifs are to avoid migration problems
      if (!_config.wallet) {
        _config.wallet = this.defaultConfig.wallet;
      }
      if (!_config.wallet.settings.unitCode) {
        _config.wallet.settings.unitCode = this.defaultConfig.wallet.settings.unitCode;
      }
      if (!_config.wallet.settings.unitValue) {
        if (_config.wallet.settings.unitToBytes) {
          _config.wallet.settings.unitValue = _config.wallet.settings.unitToBytes;
        } else {
          _config.wallet.settings.unitValue = this.defaultConfig.wallet.settings.unitValue;
        }
      }
      if (!_config.wallet.settings.bbUnitName) {
        _config.wallet.settings.bbUnitName = this.defaultConfig.wallet.settings.bbUnitName;
      }
      if (!_config.wallet.settings.bbUnitValue) {
        _config.wallet.settings.bbUnitValue = this.defaultConfig.wallet.settings.bbUnitValue;
      }
      if (!_config.wallet.settings.bbUnitDecimals) {
        _config.wallet.settings.bbUnitDecimals = this.defaultConfig.wallet.settings.bbUnitDecimals;
      }
      if (!_config.wallet.settings.bbUnitCode) {
        _config.wallet.settings.bbUnitCode = this.defaultConfig.wallet.settings.bbUnitCode;
      }
      if (!_config.pushNotifications) {
        _config.pushNotifications = this.defaultConfig.pushNotifications;
      }
      if (!_config.hub) {
        _config.hub = this.defaultConfig.hub;
      }
      if (!_config.attestorAddresses) {
        _config.attestorAddresses = this.defaultConfig.attestorAddresses;
      }
      if (!_config.realNameAttestorAddresses) {
        _config.realNameAttestorAddresses = this.defaultConfig.realNameAttestorAddresses;
      }
      for (const attestorKey in this.defaultConfig.attestorAddresses) {
        if (!(attestorKey in _config.attestorAddresses)) {
          _config.attestorAddresses[attestorKey] = this.defaultConfig.attestorAddresses[attestorKey];
        }
      }
      if (!_config.hiddenAssets) {
        _config.hiddenAssets = this.defaultConfig.hiddenAssets;
      }
      if (!_config.deviceName) {
        _config.deviceName = this.getDeviceName();
      }

      this.checkAndReplaceOldUnitCode(_config.wallet.settings);
    } else {
      _config = lodash.clone(this);
      _config.deviceName = this.getDeviceName();
    }
    return _config;
  }

  checkAndReplaceOldUnitCode(setting) {
    switch (setting.unitCode) {
      case 'byte':
        setting.unitCode = 'one';
        setting.unitValue = 1;
        break;
      case 'kB':
        setting.unitCode = 'kilo';
        setting.unitValue = 1000;
        break;
      case 'MB':
        setting.unitCode = 'mega';
        setting.unitValue = 1000000;
        break;
      case 'GB':
        setting.unitCode = 'giga';
        setting.unitValue = 1000000000;
        break;
    }
  }
}
