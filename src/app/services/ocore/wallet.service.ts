import { Injectable } from '@angular/core';
import { Platform } from '@ionic/angular';
import { Keyboard } from '@ionic-native/keyboard/ngx';
import { ProfileService } from './profile.service';
import { timeout } from 'src/app/library/Util';
import { LogService } from '../log.service';
import { OcoreConfigService } from './ocore-config.service';

import constants from 'ocore/constants.js';
import mutex from 'ocore/mutex.js';
import eventBus from 'ocore/event_bus.js';
import objectHash from 'ocore/object_hash.js';
import ecdsaSig from 'ocore/signature.js';
import breadcrumbs from 'ocore/breadcrumbs.js';
import storage from 'ocore/storage.js';
import wallet from 'ocore/wallet.js';
import ValidationUtils from 'ocore/validation_utils.js';
import device from 'ocore/device.js';
import walletDefinedByKeys from 'ocore/wallet_defined_by_keys.js';
import db from 'ocore/db.js';
import conf from 'ocore/conf.js';

import Bitcore from 'bitcore-lib';
import lodash from 'lodash';
import { StorageService } from './storage.service';
import { TxFormatService } from './tx-format.service';
import { AliasValidationService } from './alias-validation.service';
import { AddressService } from './address.service';
import { File } from '@ionic-native/file/ngx';

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  BLACKBYTES_ASSET;
  isCordova;
  isSafari;
  isMobile;
  onGoingProcess = {};
  historyShowLimit = 10;
  updatingTxHistory = {};
  bSwipeSuspended = false;
  assetsSet = {};
  arrBalances = [];
  assetIndex = 0;

  shared_address;
  completeHistory;
  txHistory;
  historyShowShowAll;

  totalUSDBalance = 0;
  isBackupReminderShown = false;
  backupExceedingAmountUSD;

  catchup_balls_at_start = -1;


  configWallet;
  walletSettings;
  unitValue;
  bbUnitValue;
  unitName;
  bbUnitName;
  unitDecimals;
  current_payment_key;
  copayers;

  constructor(
    private platform: Platform,
    // private keyboard: Keyboard,
    private configService: OcoreConfigService,
    private storageService: StorageService,
    private log: LogService,
    private txFormatService: TxFormatService,
    private aliasValidationService: AliasValidationService,
    private addressService: AddressService,
    public profileService: ProfileService,
    private file: File
  ) {

  }
  init() {
    const config = this.configService.getSync();
    this.configWallet = config.wallet;
    this.walletSettings = this.configWallet.settings;
    this.unitValue = this.walletSettings.unitValue;
    this.bbUnitValue = this.walletSettings.bbUnitValue;
    this.unitName = this.walletSettings.unitName;
    this.bbUnitName = this.walletSettings.bbUnitName;
    this.unitDecimals = this.walletSettings.unitDecimals;
  }

  getMainWalletAddress(cb = null): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const walletAddressed = await this.getWalletAddress();
      const { address } = walletAddressed[0];
      if (cb) {
        cb(address);
      }
      resolve(address);
    });
  }

  getWalletById(walletId: string): Promise<any> { // {address, createdOn, path}
    return new Promise(async (resolve, reject) => {
      const walletClient = this.profileService.walletClients[walletId];
      if (!walletClient) {
        resolve(null);
        return;
      }

      walletClient.getAddresses({
        doNotVerify: true
      }, (err, addrs) => {
        resolve(addrs[0]);
      });
    });
  }

  getWalletAddressByIndex(index: number): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const walletAddressed = await this.getWalletAddress();
      const { address } = walletAddressed[index];
      resolve(address);
    });
  }

  // [{"address": "QUEEOFXA4UNQIGY7XUKWW3OK7OJ7UNPI", createdOn, path}]
  getWalletAddress(cb = null): Promise<any> {
    return new Promise((resolve, reject) => {
      const fc = this.profileService.focusedClient;
      fc.getAddresses({
        doNotVerify: true
      }, (err, addrs) => {
        if (cb) {
          cb(addrs);
        }
        resolve(addrs);
      });
    });
  }

  getWalletBalances(cb = null): Promise<any> {
    return new Promise((resolve, reject) => {
      const fc = this.profileService.focusedClient;
      fc.getListOfBalancesOnAddresses((listOfBalances) => {
        listOfBalances = listOfBalances.map((row) => {
          row.amountNumber = row.amount;
          row.amount = this.profileService.formatAmountWithUnit(row.amount, row.asset, { dontRound: true });
          return row;
        });
        // groupBy address
        const assocListOfBalances = {};
        listOfBalances.forEach((row) => {
          if (assocListOfBalances[row.address] === undefined) { assocListOfBalances[row.address] = []; }
          assocListOfBalances[row.address].push(row);
        });
        if (cb) {
          cb(assocListOfBalances);
        }
        resolve(assocListOfBalances);
      });
    });
  }

  async getFocusedWalletBalance(): Promise<any> {
    const balances = await this.getWalletBalances();
    for (const address in balances) {
      if (balances.hasOwnProperty(address)) {
        return balances[address][0];
      }
    }

    return {
      asset: 'GSC',
      amount: '0.0 GSC',
      amountNumber: 0
    };
  }

  async getWalletBalanceByAddress(walletAddress): Promise<any> {
    const balances = await this.getWalletBalances();
    if (balances[walletAddress]) {
      return balances[walletAddress][0];
    }

    return {
      asset: 'GSC',
      amount: '0.0 GSC',
      amountNumber: 0
    };
  }

  processNewTxs(txs) {
    const now = Math.floor(Date.now() / 1000);
    const ret = [];

    lodash.each(txs, (tx) => {
      tx = this.txFormatService.processTx(tx);

      // no future transactions...
      if (tx) {
        if (tx.time > now) {
          tx.time = now;
        }
        ret.push(tx);
      }
    });
    return ret;
  }

  getLocalTxHistoryByAddress(client, walletAddress, cb) {
    const historyShowLimit = 10;
    this.getWalletBalances(arrBalances => {
      arrBalances = arrBalances[walletAddress];
      // breadcrumbs.add('index: ' + self.assetIndex + '; balances: ' + JSON.stringify(self.arrBalances));
      if (!client.isComplete()) {
        cb({}, 'fc incomplete yet');
        return console.log('fc incomplete yet');
      }
      client.getTxHistory('base', walletAddress, (txs) => {
        const newHistory = this.processNewTxs(txs);
        return cb({
          completeHistory: newHistory,
          txHistory: newHistory.slice(0, historyShowLimit),
          historyShowShowAll: newHistory.length >= historyShowLimit
        }, null);
      });
    });
  }

  getLocalTxHistory(client, cb) {
    this.getWalletAddress(walletAddress => {
      if (walletAddress.length === 0) {
        cb({}, 'No wallet address');
        return;
      }
      walletAddress = walletAddress[0].address;
      const assetIndex = 0;
      this.getLocalTxHistoryByAddress(client, walletAddress, cb);
    });
  }

  async getCopayers() {
    return new Promise((resolve, reject) => {
      const { walletId } = this.profileService.focusedClient.credentials;
      walletDefinedByKeys.readCosigners(walletId, (arrCosignerInfos) => {
        this.copayers = arrCosignerInfos;
        resolve(this.copayers);
      });
    });
  }

  /**
   *
   * @param params contain address, amount, bSendAll
   * @param cb cb details
   */
  async submitPayment(senderAddress, params: { address, amount, bSendAll }, cb = null) {
    let { address, amount } = params;
    const { bSendAll } = params;
    let arrBalances = await this.getWalletBalances();
    const myAddress = senderAddress;
    // amount of null means send all
    if (amount !== null) {
      amount = amount.replace(/ /g, '');
    }
    arrBalances = arrBalances[myAddress];

    await this.getCopayers();
    if (arrBalances.length === 0) {
      return cb && cb('send payment: no balances yet');
    }
    const assetIndex = 0;
    const fc = this.profileService.focusedClient;
    const unitValue = this.unitValue;
    const bbUnitValue = this.bbUnitValue;

    const isMultipleSend = false;

    if (fc.isPrivKeyEncrypted()) {
      this.profileService.unlockFC(null, (err) => {
        if (err) {
          return cb && cb(err.message);
        }
        return this.submitPayment(myAddress, params, cb);
      });
      return;
    }

    const assetInfo = arrBalances[assetIndex];
    const asset = assetInfo.asset;

    const recipient_device_address = null;  // assocDeviceAddressesByPaymentAddress[address];
    // address can be [bytreball_addr, email, account, empty => social sharing]
    const accountValidationResult = this.aliasValidationService.validate(address);
    let isEmail = ValidationUtils.isValidEmail(address);
    let isTextcoin = (isEmail || !address);

    let original_address;  // might be sent to email if the email address is attested
    if (isTextcoin) {
      address = 'textcoin:' + (address ? address : (Date.now() + '-' + amount));
    }
    if (asset === 'base') {
      amount *= unitValue;
    } else if (asset === constants.BLACKBYTES_ASSET) {
      amount *= bbUnitValue;
    } else if (assetInfo.decimals) {
      amount *= Math.pow(10, assetInfo.decimals);
    }
    amount = Math.round(amount);

    const current_payment_key = '' + asset + address + amount;

    const merkle_proof = '';
    this.current_payment_key = current_payment_key;
    timeout(() => {

      if (!isMultipleSend && accountValidationResult.isValid) { // try to replace validation result with attested BB address
        const attestorKey = accountValidationResult.attestorKey;
        const account = accountValidationResult.account;
        const bb_address = this.aliasValidationService.getBbAddress(
          attestorKey,
          account
        );
        console.log('attestorKey=' + attestorKey + ' : account=' + account + ' : bb_address=' + bb_address);

        if (!bb_address) {
          return this.aliasValidationService.resolveValueToBbAddress(
            attestorKey,
            account,
            () => {
              // assocBbAddresses in aliasValidationService is now filled
              delete this.current_payment_key;
              this.submitPayment(myAddress, params, cb);
            }
          );
        }

        if (!isEmail) {
          if (bb_address === 'unknown' || bb_address === 'none') {
            if (bb_address === 'unknown') {
              this.aliasValidationService.deleteAssocBbAddress(
                attestorKey,
                account
              );
            }

            delete this.current_payment_key;
            return cb && cb('Attested account not found');
          } else if (ValidationUtils.isValidAddress(bb_address)) {
            original_address = address;
            address = bb_address;
            isEmail = false;
            isTextcoin = false;
          } else {
            throw Error('unrecognized bb_address: ' + bb_address);
          }

        } else {
          if (bb_address === 'unknown') {
            this.aliasValidationService.deleteAssocBbAddress(
              attestorKey,
              account
            ); // send textcoin now but retry next time
          } else if (bb_address === 'none') {
            // go on to send textcoin
          } else if (ValidationUtils.isValidAddress(bb_address)) {
            original_address = account;
            address = bb_address;
            isEmail = false;
            isTextcoin = false;
          } else {
            throw Error('unrecognized bb_address: ' + bb_address);
          }
        }
      }

      this.profileService.requestTouchid(async (err) => {
        if (err) {
          this.profileService.lockFC();
          timeout(() => {
            delete this.current_payment_key;
          }, 1);
          return cb && cb(err);
        }

        const shared_address = myAddress;
        const outputs = [];

        // compose and send
        const composeAndSend = (to_address) => {
          let arrSigningDeviceAddresses = []; // empty list means that all signatures are required (such as 2-of-2)
          if (fc.credentials.m < fc.credentials.n) {
            this.copayers.forEach((copayer) => {
              if (copayer.me || copayer.signs) {
                arrSigningDeviceAddresses.push(copayer.device_address);
              }
            });
          } else if (shared_address) {
            arrSigningDeviceAddresses = this.copayers.map((copayer) => {
              return copayer.device_address;
            });
          }
          breadcrumbs.add('sending payment in ' + asset);
          this.profileService.bKeepUnlocked = true;
          const opts: any = {
            shared_address,
            merkle_proof,
            asset,
            do_not_email: true,
            send_all: bSendAll,
            spend_unconfirmed: this.configWallet.spendUnconfirmed ? 'all' : 'own',
            arrSigningDeviceAddresses,
            recipient_device_address
          };
          if (!isMultipleSend) {
            opts.to_address = to_address;
            opts.amount = amount;
          } else {
            if (asset !== 'base') {
              opts.asset_outputs = outputs;
            } else {
              opts.base_outputs = outputs;
            }
          }
          let filePath;
          if (assetInfo.is_private) {
            opts.getPrivateAssetPayloadSavePath = (_cb) => {
              this.getPrivatePayloadSavePath((fullPath, cordovaPathObj) => {
                filePath = fullPath ? fullPath : (cordovaPathObj ? cordovaPathObj.root +
                  cordovaPathObj.path + '/' + cordovaPathObj.fileName : null);
                _cb(fullPath, cordovaPathObj);
              });
            };
          }
          fc.sendMultiPayment(opts, (_err, unit, mnemonics) => {
            breadcrumbs.add('done payment in ' + asset + ', err=' + _err);
            delete this.current_payment_key;
            this.profileService.bKeepUnlocked = false;
            if (_err) {
              if (typeof _err === 'object') {
                _err = JSON.stringify(_err);
              } else if (_err.match(/device address/)) {
                err = 'This is a private asset, please send it only by clicking links from chat';
              } else if (_err.match(/no funded/)) {
                err = 'Not enough spendable funds, make sure all your funds are confirmed';
              } else if (_err.match(/authentifier verification failed/)) {
                err = 'Check that smart contract conditions are satisfied and signatures are correct';
              } else if (_err.match(/precommit/)) {
                _err = _err.replace('precommit callback failed: ', '');
              }
              return cb && cb(_err);
            }
            if (original_address) {
              db.query('INSERT INTO original_addresses (unit, address, original_address) VALUES(?,?,?)',
                [unit, to_address, original_address]);
            }
            if (cb) {
              cb();
            }
          });
        };

        composeAndSend(address);
      });
    }, 100);
  }

  getPrivatePayloadSavePath(cb) {
    const fileName = 'XubayPayment-' + Date.now() + '.' + this.configService.privateTextcoinExt;
    const root = this.file.cacheDirectory;
    const path = 'Obyte';
    cb(null, { root, path, fileName });
  }

  isValidAddress(value) {
    return this._isValidAddress(value) || this.aliasValidationService.isValid(value);
  }

  _isValidAddress(value) {
    if (!value) {
      return false;
    }

    // byteball uri
    let re = new RegExp('^' + conf.program + ':([A-Z2-7]{32})\b', 'i');
    let arrMatches = value.match(re);
    if (arrMatches) {
      return ValidationUtils.isValidAddress(arrMatches[1]);
    }

    re = new RegExp('^' + conf.program.replace(/byteball/i, 'obyte') + ':([A-Z2-7]{32})\b', 'i');
    arrMatches = value.match(re);
    if (arrMatches) {
      return ValidationUtils.isValidAddress(arrMatches[1]);
    }

    return ValidationUtils.isValidAddress(value);
  }
}
