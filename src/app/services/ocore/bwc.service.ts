import { Injectable } from '@angular/core';
import Client from '../../../../angular-bitcore-wallet-client/bitcore-wallet-client';

@Injectable({
  providedIn: 'root'
})
export class BwcService {
  constructor() { }

  getBitcore() {
    return Client.Bitcore;
  }

  getSJCL() {
    return Client.sjcl;
  }

  getUtils() {
    return Client.Utils;
  }

  getClient(walletData = null) {
    const bwc = new Client({});
    if (walletData) {
      bwc.import(walletData);
    }
    return bwc;
  }
}
