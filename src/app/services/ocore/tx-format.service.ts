import { Injectable } from '@angular/core';
import constants from 'ocore/constants.js';
import lodash from 'lodash';
import { ProfileService } from './profile.service';

@Injectable({
  providedIn: 'root'
})
export class TxFormatService {

  constructor(
    private profileService: ProfileService
  ) { }

  formatAmountStr(amount, asset) {
    if (!amount) { return; }
    if (asset !== 'base' && asset !== constants.BLACKBYTES_ASSET && !this.profileService.assetMetadata[asset]) {
      return amount;
    }
    return this.profileService.formatAmountWithUnit(amount, asset);
  }

  formatFeeStr(fee) {
    if (!fee) { return; }
    return fee + ' bytes';
  }

  processTx(tx) {
    if (!tx) { return; }

    const outputs = tx.outputs ? tx.outputs.length : 0;
    if (outputs > 1 && tx.action !== 'received') {
      tx.hasMultiplesOutputs = true;
      tx.recipientCount = outputs;
      tx.amount = lodash.reduce(tx.outputs, function(total, o) {
        o.amountStr = this.formatAmountStr(o.amount, tx.asset);
        return total + o.amount;
      }, 0);
    }

    tx.amountStr = this.formatAmountStr(tx.amount, tx.asset);
    tx.feeStr = this.formatFeeStr(tx.fee || tx.fees);

    return tx;
  }
}
