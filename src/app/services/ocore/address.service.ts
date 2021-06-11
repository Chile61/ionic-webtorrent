import { Injectable } from '@angular/core';
import { LogService } from '../log.service';
import { ProfileService } from './profile.service';
import { timeout } from 'src/app/library/Util';

@Injectable({
  providedIn: 'root'
})
export class AddressService {

  constructor(
    private log: LogService,
    public profileService: ProfileService
  ) { }


  expireAddress(walletId, cb) {
    this.log.debug('Cleaning Address ' + walletId);
    cb();
  }

  _createAddress(walletId, cb) {
    const client = this.profileService.getClient(walletId);

    this.log.debug('Creating address for wallet:', walletId);


    client.createAddress(0, (err, addr) => {
      if (err) {
        throw new Error('impossible err creating address');
      }
      return cb(null, addr.address);
    });
  }

  getAddress(walletId, forceNew, cb) {
    if (forceNew) {
      this._createAddress(walletId, (err, addr) => {
        timeout(() => {
          if (err) {
            return cb(err);
          }
          cb(null, addr);
        });
      });
    } else {
      const client = this.profileService.getClient(walletId);
      client.getAddresses({ reverse: true, limit: 1, is_change: 0 }, (err, addr) => {
        timeout(() => {
          if (err) {
            return cb(err);
          }
          if (addr.length > 0) {
            return cb(null, addr[0].address);
          } else { // issue new address
            this.getAddress(walletId, true, cb);
          }
        });
      });
    }
  }

  getWalletAddress(cb: (address) => void) {
    const { walletId } = this.profileService.focusedClient.credentials;
    if (walletId === null) { return null; }

    this.getAddress(walletId, false, (err, address) => {
      cb(address);
    });
  }
}
