import { Injectable } from '@angular/core';
import async from 'async';
import conf from 'ocore/conf.js';
import wallet_defined_by_keys from 'ocore/wallet_defined_by_keys.js';
import objectHash from 'ocore/object_hash.js';
import ecdsa from 'secp256k1';
import Mnemonic from 'bitcore-mnemonic';
import Bitcore from 'bitcore-lib';
import db from 'ocore/db.js';
import network from 'ocore/network';
import myWitnesses from 'ocore/my_witnesses';
import breadcrumbs from 'ocore/breadcrumbs.js';
import device from 'ocore/device';

import { ProfileService } from './profile.service';

@Injectable({
  providedIn: 'root'
})
export class RecoveryFromSeedService {
  error;
  bLight;
  scanning = false;
  inputMnemonic = '';
  xPrivKey: any = '';
  assocIndexesToWallets = {};

  onSuccess;
  onFailure;

  constructor(
    private profileService: ProfileService,
  ) {
    this.bLight = conf.bLight;
  }

  recoveryForm(inputMnemonic: string, onSuccess, onFailure) {
    inputMnemonic = inputMnemonic.toLowerCase();
    this.inputMnemonic = inputMnemonic;
    this.onSuccess = onSuccess;
    this.onFailure = onFailure;

    if ((inputMnemonic.split(' ').length % 3 === 0) && Mnemonic.isValid(inputMnemonic)) {
      this.scanning = true;
      this.error = '';

      if (this.bLight) {
        this.scanForAddressesAndWalletsInLightClient(inputMnemonic, this.cleanAndAddWalletsAndAddresses.bind(this));
      } else {
        this.scanForAddressesAndWallets(inputMnemonic, this.cleanAndAddWalletsAndAddresses.bind(this));
      }
      return true;
    }

    this.error = 'Invalid Mnemonic';
    return false;
  }


  determineIfAddressUsed(address, cb) {
    db.query('SELECT 1 FROM outputs WHERE address = ? LIMIT 1', [address], (outputsRows) => {
      if (outputsRows.length === 1) {
        cb(true);
      } else {
        db.query('SELECT 1 FROM unit_authors WHERE address = ? LIMIT 1', [address], (unitAuthorsRows) => {
          cb(unitAuthorsRows.length === 1);
        });
      }
    });
  }

  scanForAddressesAndWallets(mnemonic, cb) {
    this.xPrivKey = new Mnemonic(mnemonic).toHDPrivateKey();
    let xPubKey;
    let lastUsedAddressIndex = -1;
    let lastUsedWalletIndex = -1;
    let currentAddressIndex = 0;
    let currentWalletIndex = 0;
    const assocMaxAddressIndexes = {};
    let checkAndAddCurrentAddress: (is_change) => void;
    let setCurrentWallet: () => void;
    checkAndAddCurrentAddress = (is_change) => {
      const address = objectHash.getChash160(['sig', { pubkey: wallet_defined_by_keys.derivePubkey(xPubKey,
            'm/' + is_change + '/' + currentAddressIndex) }]);
      this.determineIfAddressUsed(address, (bUsed) => {
        if (bUsed) {
          lastUsedAddressIndex = currentAddressIndex;
          if (!assocMaxAddressIndexes[currentWalletIndex]) { assocMaxAddressIndexes[currentWalletIndex] = { main: 0 }; }
          if (is_change) {
            assocMaxAddressIndexes[currentWalletIndex].change = currentAddressIndex;
          } else {
            assocMaxAddressIndexes[currentWalletIndex].main = currentAddressIndex;
          }
          currentAddressIndex++;
          checkAndAddCurrentAddress(is_change);
        } else {
          currentAddressIndex++;
          if (currentAddressIndex - lastUsedAddressIndex >= 20) {
            if (is_change) {
              if (lastUsedAddressIndex !== -1) {
                lastUsedWalletIndex = currentWalletIndex;
              }
              if (currentWalletIndex - lastUsedWalletIndex >= 20) {
                cb(assocMaxAddressIndexes);
              } else {
                currentWalletIndex++;
                setCurrentWallet();
              }
            } else {
              currentAddressIndex = 0;
              checkAndAddCurrentAddress(1);
            }
          } else {
            checkAndAddCurrentAddress(is_change);
          }
        }
      });
    };

    setCurrentWallet = () => {
      xPubKey = Bitcore.HDPublicKey(this.xPrivKey.derive('m/44\'/0\'/' + currentWalletIndex + '\''));
      lastUsedAddressIndex = -1;
      currentAddressIndex = 0;
      checkAndAddCurrentAddress(0);
    };

    setCurrentWallet();
  }

  removeAddressesAndWallets(cb) {
    const arrQueries = [];
    db.addQuery(arrQueries, 'DELETE FROM pending_shared_address_signing_paths');
    db.addQuery(arrQueries, 'DELETE FROM shared_address_signing_paths');
    db.addQuery(arrQueries, 'DELETE FROM pending_shared_addresses');
    db.addQuery(arrQueries, 'DELETE FROM shared_addresses');
    db.addQuery(arrQueries, 'DELETE FROM my_addresses');
    db.addQuery(arrQueries, 'DELETE FROM wallet_signing_paths');
    db.addQuery(arrQueries, 'DELETE FROM extended_pubkeys');
    db.addQuery(arrQueries, 'DELETE FROM wallets');
    db.addQuery(arrQueries, 'DELETE FROM correspondent_devices');

    async.series(arrQueries, cb);
  }

  createAddresses(assocMaxAddressIndexes, cb) {
    const accounts = Object.keys(assocMaxAddressIndexes);
    let currentAccount = 0;
    let addAddress: (wallet, is_change, index, maxIndex) => void;
    const startAddToNewWallet = (is_change) => {
      if (is_change) {
        if (assocMaxAddressIndexes[accounts[currentAccount]].change !== undefined) {
          addAddress(this.assocIndexesToWallets[accounts[currentAccount]], 1, 0, assocMaxAddressIndexes[accounts[currentAccount]].change);
        } else {
          currentAccount++;
          (currentAccount < accounts.length) ? startAddToNewWallet(0) : cb();
        }
      } else {
        const maxIndex = assocMaxAddressIndexes[accounts[currentAccount]].main ?
            (assocMaxAddressIndexes[accounts[currentAccount]].main + 20) : 0;
        addAddress(this.assocIndexesToWallets[accounts[currentAccount]], 0, 0, maxIndex);
      }
    };

    addAddress = (wallet, is_change, index, maxIndex) => {
      wallet_defined_by_keys.issueAddress(wallet, is_change, index, (addressInfo) => {
        index++;
        if (index <= maxIndex) {
          addAddress(wallet, is_change, index, maxIndex);
        } else {
          if (is_change) {
            currentAccount++;
            (currentAccount < accounts.length) ? startAddToNewWallet(0) : cb();
          } else {
            startAddToNewWallet(1);
          }
        }
      });
    };

    startAddToNewWallet(0);
  }

  createWallets(arrWalletIndexes, assocMaxAddressIndexes, cb) {

    const createWallet = (n) => {
      const account = parseInt(arrWalletIndexes[n]);
      const opts: any = {};
      opts.m = 1;
      opts.n = 1;
      opts.name = 'Wallet #' + account;
      opts.network = 'livenet';
      opts.cosigners = [];
      opts.extendedPrivateKey = this.xPrivKey;
      opts.mnemonic = this.inputMnemonic;
      opts.account = account;
      opts.isSingleAddress = assocMaxAddressIndexes[account].main === 0 && assocMaxAddressIndexes[account].change === undefined;

      this.profileService.createWallet(opts, (err, walletId) => {
        if (opts.isSingleAddress) {
          this.profileService.setSingleAddressFlag(true);
        }
        this.assocIndexesToWallets[account] = walletId;
        n++;
        (n < arrWalletIndexes.length) ? createWallet(n) : cb();
      });
    };

    createWallet(0);
  }

  scanForAddressesAndWalletsInLightClient(mnemonic, cb) {
    this.xPrivKey = new Mnemonic(mnemonic).toHDPrivateKey();
    let xPubKey;
    let currentWalletIndex = 0;
    let lastUsedWalletIndex = -1;
    const assocMaxAddressIndexes = {};
    let setCurrentWallet: () => void;
    const checkAndAddCurrentAddresses = (is_change) => {
      const type = is_change ? 'change' : 'main';
      const batchSize = assocMaxAddressIndexes[currentWalletIndex] ? 20 : 1;
      // first invocation checks only 1 address to detect single-address wallets
      if (!assocMaxAddressIndexes[currentWalletIndex]) {
        assocMaxAddressIndexes[currentWalletIndex] = {};
      }
      const arrTmpAddresses = [];
      const startIndex = (assocMaxAddressIndexes[currentWalletIndex][type] === undefined) ? 0 :
          (assocMaxAddressIndexes[currentWalletIndex][type] + 1);
      for (let i = 0; i < batchSize; i++) {
        const index = startIndex + i;
        arrTmpAddresses.push(objectHash.getChash160(['sig',
          { pubkey: wallet_defined_by_keys.derivePubkey(xPubKey, 'm/' + is_change + '/' + index) }]));
      }
      myWitnesses.readMyWitnesses((arrWitnesses) => {
        network.requestFromLightVendor('light/get_history', {
          addresses: arrTmpAddresses,
          witnesses: arrWitnesses
        }, (ws, request, response) => {
          if (response && response.error) {
            breadcrumbs.add('Error scanForAddressesAndWalletsInLightClient: ' + response.error);
            this.error = 'When scanning an error occurred, please try again later.';
            this.scanning = false;
            if (this.onFailure) {
              this.onFailure();
            }
            return;
          }
          if (Object.keys(response).length) {
            lastUsedWalletIndex = currentWalletIndex;
            assocMaxAddressIndexes[currentWalletIndex][type] = startIndex + batchSize - 1;
            checkAndAddCurrentAddresses(is_change);
          } else {
            if (batchSize === 1) { // not a single-address wallet, retry for multi-address wallet
              return checkAndAddCurrentAddresses(is_change);
            }
            if (is_change) {
              if (assocMaxAddressIndexes[currentWalletIndex].change === undefined &&
                  assocMaxAddressIndexes[currentWalletIndex].main === undefined) {
                delete assocMaxAddressIndexes[currentWalletIndex];
              }
              currentWalletIndex++;
              if (currentWalletIndex - lastUsedWalletIndex > 3) {
                cb(assocMaxAddressIndexes);
              } else {
                setCurrentWallet();
              }
            } else {
              checkAndAddCurrentAddresses(1);
            }
          }
        });
      });
    };

    setCurrentWallet = () => {
      xPubKey = Bitcore.HDPublicKey(this.xPrivKey.derive('m/44\'/0\'/' + currentWalletIndex + '\''));
      checkAndAddCurrentAddresses(0);
    };

    setCurrentWallet();
  }

  cleanAndAddWalletsAndAddresses(assocMaxAddressIndexes) {
    const arrWalletIndexes = Object.keys(assocMaxAddressIndexes);
    if (arrWalletIndexes.length) {
      this.removeAddressesAndWallets(() => {
        const myDeviceAddress = objectHash.getDeviceAddress(ecdsa.publicKeyCreate(
            this.xPrivKey.derive('m/1\'').privateKey.bn.toBuffer({ size: 32 }), true).toString('base64'));
        this.profileService.replaceProfile(this.xPrivKey.toString(), this.inputMnemonic, myDeviceAddress, () => {
          device.setDevicePrivateKey(this.xPrivKey.derive('m/1\'').privateKey.bn.toBuffer({ size: 32 }));
          this.createWallets(arrWalletIndexes, assocMaxAddressIndexes, () => {
            this.createAddresses(assocMaxAddressIndexes, () => {
              this.scanning = false;
              if (this.onSuccess) {
                this.onSuccess();
              }
            });
          });
        });
      });
    } else {
      this.error = 'No active addresses found.';
      this.scanning = false;
      if (this.onFailure) {
        this.onFailure();
      }
    }
  }
}
