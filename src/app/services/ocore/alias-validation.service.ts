import { Injectable } from '@angular/core';
import ValidationUtils from 'ocore/validation_utils.js';
import { timeout } from 'src/app/library/Util';
import { OcoreConfigService } from './ocore-config.service';

@Injectable({
  providedIn: 'root'
})
export class AliasValidationService {

  listOfAliases = {
    email: {
      dbKey: 'email',
      title: 'email',
      isValid: (value) => {
        return ValidationUtils.isValidEmail(value);
      },
      transformToAccount: (value) => {
        return value.replace(/^textcoin:/, '').toLowerCase();
      }
    },
    reddit: {
      dbKey: 'reddit_username',
      title: 'reddit account',
      isValid: (value) => {
        return /^reddit\/[a-z0-9\-_]{3,20}$/i.test(value);
      },
      transformToAccount: (value) => {
        return value.replace(/^reddit\//i, '').toLowerCase();
      }
    },
    steem: {
      dbKey: 'steem_username',
      title: 'steem account',
      isValid: (value) => {
        return /^steem\/[a-z0-9\-_.]{3,20}$/i.test(value);
      },
      transformToAccount: (value) => {
        return value.replace(/^steem\//i, '').toLowerCase();
      }
    },
    username: {
      dbKey: 'username',
      title: 'username',
      isValid: (value) => {
        return /^@([a-z\d\-_]){1,32}$/i.test(value);
      },
      transformToAccount: (value) => {
        return value.substr(1).toLowerCase();
      }
    },
    phone: {
      dbKey: 'phone',
      title: 'phone number',
      isValid: (value) => {
        return /^\+?\d{9,14}$/.test(value);
      },
      transformToAccount: (value) => {
        return value.replace('+', '');
      }
    }
  };
  assocBbAddresses = {};

  constructor(
    private configService: OcoreConfigService
  ) {
    for (const attestorKey in this.listOfAliases) {
      if (!this.listOfAliases.hasOwnProperty(attestorKey)) { continue; }
      this.assocBbAddresses[attestorKey] = {};
    }
  }


  getAliasObj(attestorKey) {
    if (!(attestorKey in this.listOfAliases)) {
      throw new Error('unknown alias');
    }
    return this.listOfAliases[attestorKey];
  }

  getListOfAliases() {
    return this.listOfAliases;
  }

  validate(value) {
    for (const attestorKey in this.listOfAliases) {
      if (!this.listOfAliases.hasOwnProperty(attestorKey)) { continue; }
      if (this.listOfAliases[attestorKey].isValid(value)) {
        const account = this.listOfAliases[attestorKey].transformToAccount(value);
        return { isValid: true, attestorKey, account };
      }
    }
    return { isValid: false };
  }

  checkAliasExists(attestorKey) {
    if (!this.listOfAliases.hasOwnProperty(attestorKey)) {
      throw new Error('Alias not found');
    }
  }

  getBbAddress(attestorKey, value) {
    this.checkAliasExists(attestorKey);
    return this.assocBbAddresses[attestorKey][value];
  }

  deleteAssocBbAddress(attestorKey, value) {
    this.checkAliasExists(attestorKey);
    delete this.assocBbAddresses[attestorKey][value];
  }

  resolveValueToBbAddress(attestorKey, value, callback) {
    const setResult = (result) => {
      this.assocBbAddresses[attestorKey][value] = result;
      timeout(callback);
    };

    this.checkAliasExists(attestorKey);

    if (!this.listOfAliases[attestorKey]) {
      throw new Error('Alias not found');
    }

    const obj = this.listOfAliases[attestorKey];
    const attestorAddress = this.configService.getSync().attestorAddresses[attestorKey];
    if (!attestorAddress) {
      return setResult('none');
    }

    const conf = require('ocore/conf.js');
    const db = require('ocore/db.js');
    db.query(
      'SELECT \n\
				address, is_stable \n\
			FROM attested_fields \n\
			CROSS JOIN units USING(unit) \n\
			WHERE attestor_address=? \n\
				AND field=? \n\
				AND value=? \n\
			ORDER BY attested_fields.rowid DESC \n\
			LIMIT 1',
      [attestorAddress, obj.dbKey, value],
      (rows) => {
        if (rows.length > 0) {
          return setResult((!conf.bLight || rows[0].is_stable) ? rows[0].address : 'unknown');
        }
        // not found
        if (!conf.bLight) {
          return setResult('none');
        }
        // light
        const network = require('ocore/network.js');
        const params = { attestor_address: attestorAddress, field: obj.dbKey, value };
        network.requestFromLightVendor('light/get_attestation', params, (ws, request, response) => {
          if (response.error) {
            return setResult('unknown');
          }

          const attestation_unit = response;
          if (attestation_unit === '') {// no attestation
            return setResult('none');
          }

          network.requestHistoryFor([attestation_unit], [], (err) => {
            if (err) {
              return setResult('unknown');
            }
            // now attestation_unit is in the db (stable or unstable)
            this.resolveValueToBbAddress(attestorKey, value, callback);
          });
        });
      }
    );
  }

  isValid(value) {
    for (const attestorKey in this.listOfAliases) {
      if (!this.listOfAliases.hasOwnProperty(attestorKey)) { continue; }
      if (this.listOfAliases[attestorKey].isValid(value)) {
        return true;
      }
    }
    return false;
  }

}
