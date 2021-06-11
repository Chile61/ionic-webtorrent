import { Injectable } from '@angular/core';
import { Subscription } from 'rxjs';
import { timeout } from 'src/app/library/Util';
import { AddressService } from './address.service';
import { EventService } from './event.service';
import { ProfileService } from './profile.service';

@Injectable({
  providedIn: 'root'
})
export class TorrentWalletService {
  isSingleAddress = false;
  loading = false;

  constructor(
    private profileService: ProfileService,
    private addressService: AddressService
  ) { }

  createWalletAddress(): Promise<string> { // address
    return new Promise(async (resolve, reject) => {
      const { walletId: focusedWalletId } = this.profileService.focusedClient.credentials;
      this.addressService.getAddress(focusedWalletId, true, (err, address) => {
        resolve(address);
      });
    });
  }

  _create(opts): Promise<any> {
    return new Promise((resolve, reject) => {
      this.loading = true;
      timeout(() => {
        this.profileService.createWallet(opts, (err, walletId) => {
          this.loading = false;
          if (err) {
            reject(err);
            return;
          }

          if (opts.isSingleAddress) {
            this.profileService.setSingleAddressFlag(true);
          }

          resolve(walletId);
        });
      });
    });
  }
}
