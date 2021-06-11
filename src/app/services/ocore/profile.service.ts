import { Injectable } from '@angular/core';

import lodash from 'lodash';
import Wallet from 'ocore/wallet.js'; // load hub/ message handlers
import device from 'ocore/device.js';
import light_wallet from 'ocore/light_wallet.js';
import breadcrumbs from 'ocore/breadcrumbs.js';
import constants from 'ocore/constants.js';
import walletDefinedByKeys from 'ocore/wallet_defined_by_keys.js';

import { OcoreConfigService } from './ocore-config.service';
import { LogService } from '../log.service';
import { Profile } from 'src/app/model/profile';
import { gettext, GetTextCatalog, timeout } from 'src/app/library/Util';
import { UxLanguageService } from './ux-language.service';
import { StorageService } from './storage.service';
import { BwcService } from './bwc.service';
import { EventService } from './event.service';
import { HUB_DOMAIN_FULL } from 'src/app/library/Config';

@Injectable({
  providedIn: 'root'
})
export class ProfileService {
  profile: any = {};
  assocVisitedFromStates = {};
  focusedClient = null;
  walletClients = {};
  assetMetadata = {};
  bKeepUnlocked = false;
  Utils;
  // id;

  constructor(
    private configService: OcoreConfigService,
    private uxLanguage: UxLanguageService,
    private storageService: StorageService,
    private bwcService: BwcService,
    private log: LogService,
    private event: EventService
  ) {
    this.Utils = bwcService.getUtils();
  }

  formatAmount(amount, asset, opts = null) {
    if (!opts) { opts = {}; }
    opts.thousandsSeparator = ' ';
    opts.decimalSeparator = '.';

    const config = this.configService.getSync().wallet.settings;
    return this.Utils.formatAmount(amount, config.unitCode, opts);
  }

  formatInputAmount(amount) {
    return this.Utils.formatInputAmount(amount);
  }

  formatAmountWithUnit(amount, asset, opts = { dontRound: true }) {
    return this.formatAmount(amount, asset, opts) + ' ' + this.getUnitName(asset);
  }

  formatAmountWithUnitIfShort(amount, asset, opts) {
    let str = this.formatAmount(amount, asset, opts);
    const unit = this.getUnitName(asset);
    if (unit.length <= 8) {
      str += ' ' + unit;
    }
    return str;
  }

  getUnitName(asset) {
    const config = this.configService.getSync().wallet.settings;
    if (asset === 'blackbytes' || asset === constants.BLACKBYTES_ASSET) {
      return config.bbUnitName;
    } else if (asset === 'base' || asset === 'bytes') {
      return config.unitName;
    } else if (this.assetMetadata[asset]) {
      return this.assetMetadata[asset].name;
    } else {
      return 'of ' + asset;
    }
  }

  getAmountInSmallestUnits(amount, asset) {
    const config = this.configService.getSync().wallet.settings;
    if (asset === 'base') {
      amount *= config.unitValue;
    } else if (asset === constants.BLACKBYTES_ASSET) {
      amount *= config.bbUnitValue;
    } else if (this.assetMetadata[asset]) {
      amount *= Math.pow(10, this.assetMetadata[asset].decimals || 0);
    }
    return Math.round(amount);
  }

  _setFocus(walletId, cb) {
    this.log.debug('Set focus:', walletId);

    // Set local object
    if (walletId) {
      this.focusedClient = this.walletClients[walletId];
    } else {
      this.focusedClient = [];
    }

    if (lodash.isEmpty(this.focusedClient)) {
      this.focusedClient = this.walletClients[lodash.keys(this.walletClients)[0]];
    }

    // Still nothing?
    if (lodash.isEmpty(this.focusedClient)) {
      this.event.emit('Local/NoWallets');
    } else {
      this.event.emit('Local/NewFocusedWallet');
    }

    return cb();
  }

  setAndStoreFocus(walletId, cb) {
    this._setFocus(walletId, () => {
      this.storageService.storeFocusedWalletId(walletId, cb);
    });
  }

  setWalletClient(credentials) {
    if (this.walletClients[credentials.walletId] && this.walletClients[credentials.walletId].started) {
      return;
    }

    const client = this.bwcService.getClient(JSON.stringify(credentials));

    client.credentials.xPrivKey = this.profile.xPrivKey;
    client.credentials.mnemonic = this.profile.mnemonic;
    client.credentials.xPrivKeyEncrypted = this.profile.xPrivKeyEncrypted;
    client.credentials.mnemonicEncrypted = this.profile.mnemonicEncrypted;

    this.walletClients[credentials.walletId] = client;

    this.walletClients[credentials.walletId].started = true;

    client.initialize({}, (err) => {
      if (err) {
        // impossible
        return;
      }
    });
  }

  setWalletClients() {
    const credentials = this.profile.credentials;
    lodash.each(credentials, (_credentials) => {
      this.setWalletClient(_credentials);
    });
    this.event.emit('Local/WalletListUpdated');
  }

  async saveTempKeys(tempDeviceKey, prevTempDeviceKey, onDone) {
    console.log('will save temp device keys', tempDeviceKey, prevTempDeviceKey);
    this.profile.tempDeviceKey = tempDeviceKey.toString('base64');
    if (prevTempDeviceKey) {
      this.profile.prevTempDeviceKey = prevTempDeviceKey.toString('base64');
    }

    await this.storageService.storeProfile(this.profile);
    onDone(null);
  }

  unlockWalletAndInitDevice() {
    // wait till the wallet fully loads
    breadcrumbs.add('unlockWalletAndInitDevice');

    const removeListener = this.event.on('Local/BalanceUpdated', () => {
      removeListener();
      breadcrumbs.add('unlockWalletAndInitDevice BalanceUpdated');
      this.insistUnlockFC(null, () => {
        breadcrumbs.add('unlockWalletAndInitDevice unlocked');

        // After unlock, make mainSection visible again
        if (!this.focusedClient.credentials.xPrivKey) {
          throw Error('xPrivKey still not set after unlock');
        }
        console.log('unlocked: ' + this.focusedClient.credentials.xPrivKey);
        const config = this.configService.getSync();
        this.focusedClient.initDeviceProperties(
          this.focusedClient.credentials.xPrivKey, this.profile.my_device_address, config.hub, config.deviceName);
        this.event.emit('Local/BalanceUpdatedAndWalletUnlocked');
      });
    });
  }

  bindProfile(profile, cb) {
    breadcrumbs.add('bindProfile');
    this.profile = profile;
    this.configService.get((err) => {
      this.log.debug('Preferences read');
      if (err) {
        return cb(err);
      }

      this.setWalletClients();
      this.storageService.getFocusedWalletId((_err, focusedWalletId) => {
        if (_err) {
          return cb(_err);
        }
        this._setFocus(focusedWalletId, () => {
          console.log('focusedWalletId', focusedWalletId);
          const config = this.configService.getSync();
          const firstWc = this.walletClients[lodash.keys(this.walletClients)[0]];
          // set light_vendor_url here as we may request new assets history at startup during balances update
          light_wallet.setLightVendorHost(config.hub);
          if (this.profile.xPrivKeyEncrypted) {
            console.log('priv key is encrypted, will wait for UI and request password');
            // assuming bindProfile is called on encrypted keys only at program startup
            this.unlockWalletAndInitDevice();
            device.setDeviceAddress(this.profile.my_device_address);
          } else if (this.profile.xPrivKey) {
            this.focusedClient.initDeviceProperties(profile.xPrivKey, this.profile.my_device_address, config.hub, config.deviceName);
          } else {
            throw Error('neither xPrivKey nor xPrivKeyEncrypted');
          }

          // Hub domain has changed
          if (device.getDeviceHub() !== HUB_DOMAIN_FULL) {
            device.setDeviceHub(HUB_DOMAIN_FULL);
          }

          const tempDeviceKey = Buffer.from(profile.tempDeviceKey, 'base64');
          const prevTempDeviceKey = profile.prevTempDeviceKey ? Buffer.from(profile.prevTempDeviceKey, 'base64') : null;
          device.setTempKeys(tempDeviceKey, prevTempDeviceKey, this.saveTempKeys.bind(this));
          this.event.emit('Local/ProfileBound');
          Wallet.readAssetMetadata(null, (assocAssetMetadata) => {
            for (const asset in assocAssetMetadata) {
              if (!this.assetMetadata[asset]) {
                this.assetMetadata[asset] = assocAssetMetadata[asset];
              }
            }
          });
          return cb();
        });
      });
    });
  }

  loadAndBindProfile(cb) {
    breadcrumbs.add('loadAndBindProfile');
    this.storageService.getDisclaimerFlag((err, val) => {
      if (!val) {
        breadcrumbs.add('Non agreed disclaimer');
        return cb(new Error('NONAGREEDDISCLAIMER: Non agreed disclaimer'));
      } else {
        this.storageService.getProfile((_err, profile) => {
          if (_err) {
            this.event.emit('Local/DeviceError', _err);
            return cb(_err);
          }
          if (!profile) {
            breadcrumbs.add('no profile');
            return cb(new Error('NOPROFILE: No profile'));
          } else {
            this.log.debug('Profile read');
            return this.bindProfile(profile, cb);
          }

        });
      }
    });
  }

  _seedWallet(opts, cb) {
    opts = opts || {};

    const walletClient = this.bwcService.getClient();
    const network = opts.networkName || 'livenet';

    if (opts.mnemonic) {
      try {
        opts.mnemonic = this._normalizeMnemonic(opts.mnemonic);
        walletClient.seedFromMnemonic(opts.mnemonic, {
          network,
          passphrase: opts.passphrase,
          account: opts.account || 0,
          derivationStrategy: opts.derivationStrategy || 'BIP44',
        });

      } catch (ex) {
        this.log.info(ex);
        return cb(gettext('Could not create: Invalid wallet seed'));
      }
    } else if (opts.extendedPrivateKey) {
      try {
        walletClient.seedFromExtendedPrivateKey(opts.extendedPrivateKey, opts.account || 0);
      } catch (ex) {
        this.log.warn(ex);
        return cb(gettext('Could not create using the specified extended private key'));
      }
    } else if (opts.extendedPublicKey) {
      try {
        walletClient.seedFromExtendedPublicKey(opts.extendedPublicKey, opts.externalSource, opts.entropySource, {
          account: opts.account || 0,
          derivationStrategy: opts.derivationStrategy || 'BIP44',
        });
      } catch (ex) {
        this.log.warn('Creating wallet from Extended Public Key Arg:', ex, opts);
        return cb(gettext('Could not create using the specified extended public key'));
      }
    } else {
      const lang = this.uxLanguage.getCurrentLanguage();
      console.log('will seedFromRandomWithMnemonic for language ' + lang);
      try {
        walletClient.seedFromRandomWithMnemonic({
          network,
          passphrase: opts.passphrase,
          language: lang,
          account: opts.account || 0,
        });
      } catch (e) {
        this.log.info('Error creating seed: ' + e.message);
        if (e.message.indexOf('language') > 0) {
          this.log.info('Using default language for mnemonic');
          walletClient.seedFromRandomWithMnemonic({
            network,
            passphrase: opts.passphrase,
            account: opts.account || 0,
          });
        } else {
          return cb(e);
        }
      }
    }
    return cb(null, walletClient);
  }

  async _createNewProfile(opts): Promise<Profile> {
    if (opts.noWallet) {
      return new Profile();
    }

    return new Promise((resolve, reject) => {
      this._seedWallet({}, (err, walletClient) => {
        if (err) {
          return reject(err);
        }
        const config = this.configService.getSync();
        const tempDeviceKey = device.genPrivKey();
        light_wallet.setLightVendorHost(config.hub);
        // initDeviceProperties sets my_device_address needed by walletClient.createWallet
        walletClient.initDeviceProperties(walletClient.credentials.xPrivKey, null, config.hub, config.deviceName);
        const walletName = GetTextCatalog.getString('Small Expenses Wallet');
        walletClient.createWallet(walletName, 1, 1, {
          // 	isSingleAddress: true,
          network: 'livenet'
        }, (_err) => {
          if (_err) {
            return reject(gettext('Error creating wallet') + ': ' + _err);
          }
          console.log('created wallet, client: ', JSON.stringify(walletClient));
          const xPrivKey = walletClient.credentials.xPrivKey;
          const mnemonic = walletClient.credentials.mnemonic;
          console.log('mnemonic: ' + mnemonic + ', xPrivKey: ' + xPrivKey);
          const p = new Profile({
            credentials: [JSON.parse(walletClient.export())],
            xPrivKey,
            mnemonic,
            tempDeviceKey: tempDeviceKey.toString('base64'),
            my_device_address: device.getMyDeviceAddress()
          });
          device.setTempKeys(tempDeviceKey, null, this.saveTempKeys.bind(this));
          return resolve(p);
        });
      });
    });
  }

  createWallet(opts, cb) {
    this.log.debug('Creating Wallet:', opts);
    if (!this.focusedClient.credentials.xPrivKey) { // locked
      this.unlockFC(null, (err) => {
        if (err) {
          return cb(err.message);
        }
        this.createWallet(opts, cb);
      });
      return console.log('need password to create new wallet');
    }
    walletDefinedByKeys.readNextAccount((account) => {
      console.log('next account = ' + account);
      if (!opts.extendedPrivateKey && !opts.mnemonic) {
        if (!this.focusedClient.credentials.xPrivKey) {
          throw Error('no root.focusedClient.credentials.xPrivKey');
        }
        this.log.debug('reusing xPrivKey from focused client');
        opts.extendedPrivateKey = this.focusedClient.credentials.xPrivKey;
        opts.mnemonic = this.profile.mnemonic;
        opts.account = account;
      }
      this._seedWallet(opts, (err, walletClient) => {
        if (err) {
          return cb(err);
        }

        walletClient.createWallet(opts.name, opts.m, opts.n, {
          network: opts.networkName,
          account: opts.account,
          cosigners: opts.cosigners,
          isSingleAddress: opts.isSingleAddress
        }, (_err) => {
          timeout(() => {
            if (_err) {
              return cb(gettext('Error creating wallet') + ': ' + _err);
            }
            this._addWalletClient(walletClient, opts, cb);
          });
        });
      });
    });
  }

  getClient(walletId) {
    return this.walletClients[walletId];
  }

  deleteWallet(opts, cb) {
    const client = opts.client || this.focusedClient;
    const walletId = client.credentials.walletId;
    this.log.debug('Deleting Wallet:', client.credentials.walletName);
    breadcrumbs.add('Deleting Wallet: ' + client.credentials.walletName);

    this.profile.credentials = lodash.reject(this.profile.credentials, {
      walletId
    });

    delete this.walletClients[walletId];
    this.focusedClient = null;

    this.storageService.clearBackupFlag(walletId, (err) => {
      if (err) { this.log.warn(err); }
    });

    timeout(() => {
      this.setWalletClients();
      this.setAndStoreFocus(null, () => {
        this.storageService.storeProfile(this.profile, (err) => {
          if (err) { return cb(err); }
          return cb();
        });
      });
    });
  }

  setMetaData(walletClient, addressBook, cb) {
    this.storageService.getAddressbook(walletClient.credentials.network, (err, localAddressBook) => {
      let localAddressBook1 = {};
      try {
        localAddressBook1 = JSON.parse(localAddressBook);
      } catch (ex) {
        this.log.warn(ex);
      }
      const mergeAddressBook = lodash.merge(addressBook, localAddressBook1);
      this.storageService.setAddressbook(walletClient.credentials.network, JSON.stringify(addressBook), (_err) => {
        if (_err) { return cb(_err); }
        return cb(null);
      });
    });
  }

  _addWalletClient(walletClient, opts, cb) {
    const walletId = walletClient.credentials.walletId;

    // check if exists
    const w = lodash.find(this.profile.credentials, { walletId });
    if (w) {
      return cb(gettext('Wallet already in Obyte' + ': ') + w.walletName);
    }

    this.profile.credentials.push(JSON.parse(walletClient.export()));
    this.setWalletClients();

    // assign wallet color based on first character of walletId
    const color = this.configService.colorOpts[walletId.charCodeAt(0) % this.configService.colorOpts.length];
    const configOpts = { colorFor: {} };
    configOpts.colorFor[walletId] = color;
    this.configService.set(configOpts, (err) => {
      this.setAndStoreFocus(walletId, () => {
        this.storageService.storeProfile(this.profile, (_err) => {
          const config = this.configService.getSync();
          return cb(_err, walletId);
        });
      });
    });
  }

  importWallet(str, opts, cb) {

    const walletClient = this.bwcService.getClient();

    this.log.debug('Importing Wallet:', opts);
    try {
      walletClient.import(str, {
        compressed: opts.compressed,
        password: opts.password
      });
    } catch (err) {
      return cb(gettext('Could not import. Check input file and password'));
    }

    str = JSON.parse(str);

    const addressBook = str.addressBook || {};

    this._addWalletClient(walletClient, opts, (err, walletId) => {
      if (err) { return cb(err); }
      this.setMetaData(walletClient, addressBook, (error) => {
        if (error) { console.log(error); }
        return cb(err, walletId);
      });
    });
  }

  importExtendedPrivateKey(xPrivKey, opts, cb) {
    const walletClient = this.bwcService.getClient();
    this.log.debug('Importing Wallet xPrivKey');

    walletClient.importFromExtendedPrivateKey(xPrivKey, (err) => {
      if (err) {
        return cb(gettext('Could not import') + ': ' + err);
      }

      this._addWalletClient(walletClient, opts, cb);
    });
  }

  _normalizeMnemonic(words) {
    const isJA = words.indexOf('\u3000') > -1;
    const wordList = words.split(/[\u3000\s]+/);

    return wordList.join(isJA ? '\u3000' : ' ');
  }

  importMnemonic(words, opts, cb) {

    const walletClient = this.bwcService.getClient();

    this.log.debug('Importing Wallet Mnemonic');

    words = this._normalizeMnemonic(words);
    walletClient.importFromMnemonic(words, {
      network: opts.networkName,
      passphrase: opts.passphrase,
      account: opts.account || 0,
    }, (err) => {
      if (err) {
        return cb(gettext('Could not import') + ': ' + err);
      }

      this._addWalletClient(walletClient, opts, cb);
    });
  }

  importExtendedPublicKey(opts, cb) {
    const walletClient = this.bwcService.getClient();
    this.log.debug('Importing Wallet XPubKey');

    walletClient.importFromExtendedPublicKey(opts.extendedPublicKey, opts.externalSource, opts.entropySource, {
      account: opts.account || 0,
      derivationStrategy: opts.derivationStrategy || 'BIP44',
    }, (err) => {
      if (err) {

        // in HW wallets, req key is always the same. They can't addAccess.
        if (err.code === 'NOT_AUTHORIZED') {
          err.code = 'WALLET_DOES_NOT_EXIST';
        }

        return cb(gettext('Could not import') + ': ' + err);
      }

      this._addWalletClient(walletClient, opts, cb);
    });
  }

  async create(opts, cb) {
    this.log.info('Creating profile', opts);
    await this.configService.get();
    const p = await this._createNewProfile(opts);

    this.bindProfile(p, (err) => {
      this.storageService.storeNewProfile(p, (_err) => {
        this.setSingleAddressFlag(true);
        this.storageService.setDisclaimerFlag();
        return cb(_err);
      });
    });
  }

  updateCredentialsFC(cb) {
    const fc = this.focusedClient;

    const newCredentials = lodash.reject(this.profile.credentials, {
      walletId: fc.credentials.walletId
    });
    newCredentials.push(JSON.parse(fc.export()));
    this.profile.credentials = newCredentials;
    // this.profile.my_device_address = device.getMyDeviceAddress();

    this.storageService.storeProfile(this.profile, cb);
  }

  clearMnemonic(cb) {
    delete this.profile.mnemonic;
    delete this.profile.mnemonicEncrypted;
    for (const wid in this.walletClients) {
      if (this.walletClients.hasOwnProperty(wid)) {
        this.walletClients[wid].clearMnemonic();
      }
    }
    this.storageService.storeProfile(this.profile, cb);
  }

  setPrivateKeyEncryptionFC(password, cb) {
    const fc = this.focusedClient;
    this.log.debug('Encrypting private key for', fc.credentials.walletName);
    fc.setPrivateKeyEncryption(password);
    if (!fc.credentials.xPrivKeyEncrypted) {
      throw Error('no xPrivKeyEncrypted after setting encryption');
    }
    this.profile.xPrivKeyEncrypted = fc.credentials.xPrivKeyEncrypted;
    this.profile.mnemonicEncrypted = fc.credentials.mnemonicEncrypted;
    delete this.profile.xPrivKey;
    delete this.profile.mnemonic;
    this.lockFC();
    for (const wid in this.walletClients) {
      if (this.walletClients.hasOwnProperty(wid)) {
        this.walletClients[wid].credentials.xPrivKeyEncrypted = this.profile.xPrivKeyEncrypted;
        delete this.walletClients[wid].credentials.xPrivKey;
      }
    }
    this.storageService.storeProfile(this.profile, () => {
      this.log.debug('Wallet encrypted');
      return cb();
    });
    this.updateCredentialsFC(cb);
  }


  disablePrivateKeyEncryptionFC(cb) {
    const fc = this.focusedClient;
    this.log.debug('Disabling private key encryption for', fc.credentials.walletName);

    try {
      fc.disablePrivateKeyEncryption();
    } catch (e) {
      return cb(e);
    }
    if (!fc.credentials.xPrivKey) {
      throw Error('no xPrivKey after disabling encryption');
    }
    this.profile.xPrivKey = fc.credentials.xPrivKey;
    this.profile.mnemonic = fc.credentials.mnemonic;
    delete this.profile.xPrivKeyEncrypted;
    delete this.profile.mnemonicEncrypted;
    for (const wid in this.walletClients) {
      if (this.walletClients.hasOwnProperty(wid)) {
        this.walletClients[wid].credentials.xPrivKey = this.profile.xPrivKey;
        delete this.walletClients[wid].credentials.xPrivKeyEncrypted;
      }
    }
    this.storageService.storeProfile(this.profile, () => {
      this.log.debug('Wallet encryption disabled');
      return cb();
    });
    this.updateCredentialsFC(cb);
  }

  lockFC() {
    const fc = this.focusedClient;
    try {
      fc.lock();
    } catch (e) { }
  }

  isWalletEncryptedFC() {
    const fc = this.focusedClient;
    return fc.hasPrivKeyEncrypted();
  }

  async unlockFC(error_message, cb) {
    this.log.debug('Wallet is encrypted');
    const password = await this.storageService.get('wallet_password', '');
    const fc = this.focusedClient;
    try {
      fc.unlock(password);
      breadcrumbs.add('unlocked ' + fc.credentials.walletId);
    } catch (e) {
      this.log.debug(e);
      return cb({
        message: gettext('Wrong password')
      });
    }
    const autolock = () => {
      if (this.bKeepUnlocked) {
        console.log('keeping unlocked');
        breadcrumbs.add('keeping unlocked');
        timeout(autolock, 30 * 1000);
        return;
      }
      console.log('time to auto-lock wallet', fc.credentials);
      if (fc.hasPrivKeyEncrypted()) {
        this.log.debug('Locking wallet automatically');
        try {
          fc.lock();
          breadcrumbs.add('locked ' + fc.credentials.walletId);
        } catch (e) { }
      }
    };
    timeout(autolock, 30 * 1000);
    return cb();
  }

  insistUnlockFC(error_message, cb) {
    this.unlockFC(error_message, (err) => {
      if (!err) {
        return cb();
      }
      timeout(() => {
        this.insistUnlockFC(err.message, cb);
      }, 1000);
    });
  }

  getWallets(network) {
    if (!this.profile) { return []; }

    const config = this.configService.getSync();
    config.colorFor = config.colorFor || {};
    config.aliasFor = config.aliasFor || {};
    let ret = lodash.map(this.profile.credentials, (c) => {
      return {
        m: c.m,
        n: c.n,
        is_complete: (c.publicKeyRing && c.publicKeyRing.length === c.n),
        name: config.aliasFor[c.walletId] || c.walletName,
        id: c.walletId,
        network: c.network,
        color: config.colorFor[c.walletId] || '#2C3E50'
      };
    });
    ret = lodash.filter(ret, (w) => {
      return (w.network === network && w.is_complete);
    });
    return lodash.sortBy(ret, 'name');
  }

  requestTouchid(cb) {
    const fc = this.focusedClient;
    const config = this.configService.getSync();
    config.touchIdFor = config.touchIdFor || {};
    if ((window as any).touchidAvailable && config.touchIdFor[fc.credentials.walletId]) {
      this.event.emit('Local/RequestTouchid', cb);
    } else {
      return cb();
    }
  }

  replaceProfile(xPrivKey, mnemonic, myDeviceAddress, cb) {
    this.profile.credentials = [];
    this.profile.xPrivKey = xPrivKey;
    this.profile.mnemonic = mnemonic;
    this.profile.my_device_address = myDeviceAddress;
    device.setNewDeviceAddress(myDeviceAddress);

    this.storageService.storeProfile(this.profile, () => {
      return cb();
    });
  }

  setSingleAddressFlag(newValue) {
    const fc = this.focusedClient;
    fc.isSingleAddress = newValue;
    const walletId = fc.credentials.walletId;
    const config = this.configService.getSync();
    const oldValue = config.isSingleAddress || false;

    const opts = {
      isSingleAddress: {}
    };
    opts.isSingleAddress[walletId] = newValue;
    this.configService.set(opts, (err) => {
      if (err) {
        fc.isSingleAddress = oldValue;
        return;
      }
    });
  }

  loadProfile(cb) {
    // Try to open local profile
    this.loadAndBindProfile((err) => {
      if (err) {
        if (err.message && err.message.match('NOPROFILE')) {
          this.log.debug('No profile... redirecting');
          // return $state.transitionTo('splash');
        } else if (err.message && err.message.match('NONAGREEDDISCLAIMER')) {
          this.log.debug('Display disclaimer... redirecting');
        } else {
          throw new Error(err.message || err);
        }
      } else {
        this.log.debug('Profile loaded ... Starting UX.');
        if (cb) {
          cb();
        }
      }
    });
  }

  getWalletIdByIndex(index: number) {
    if (this.profile.credentials.length <= index) { return null; }
    const { walletId } = this.profile.credentials[index];
    return walletId;
  }

  getClientByIndex(index: number) {
    const walletId = this.getWalletIdByIndex(index);
    return this.getClient(walletId);
  }
}
