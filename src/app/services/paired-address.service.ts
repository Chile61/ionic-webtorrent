import { Injectable } from '@angular/core';
import { StorageService } from './ocore/storage.service';
import { WalletService } from './ocore/wallet.service';
import { AlertController } from '@ionic/angular';
import { showAlert } from '../library/Util';

@Injectable({
  providedIn: 'root'
})
export class PairedAddressService {
  static NOT_VALID = 1;
  static DUP_NAME = 2;
  static DUP_ADDR = 3;
  static SUCCESS = 0;

  addressBookKey = 'addressBook';

  constructor(
    private storageService: StorageService,
    private walletService: WalletService
  ) { }

  list() {
    return this.storageService.get(this.addressBookKey, {});
  }

  async addWithAlert(item: { name: string, address: string }, alertCtrl: AlertController = null) {
    const result = await this.add(item);
    let message = '';
    switch (result) {
      case PairedAddressService.NOT_VALID:
        message = 'Address is not valid.'; break;
      case PairedAddressService.DUP_ADDR:
        message = 'The address is already exists.'; break;
      case PairedAddressService.DUP_NAME:
        message = 'The name is already exists.'; break;
      case PairedAddressService.SUCCESS:
        return true;
    }

    if (alertCtrl !== null) {
      showAlert(alertCtrl, message);
    }
  }

  async add(item: { name: string, address: string }) {
    const { name, address } = item;
    const isValidAddress = this.walletService.isValidAddress(address);

    if (!isValidAddress) { return PairedAddressService.NOT_VALID; }

    const contacts: Map<string, string> = await this.list();
    if (await this.toName(address)) {    return PairedAddressService.DUP_NAME; }
    if (await this.toAddress(name)) { return PairedAddressService.DUP_ADDR; }

    contacts [name] = address;
    await this.storageService.set(this.addressBookKey, contacts);

    return PairedAddressService.SUCCESS;
  }

  async toName(address) {
    const contacts: Map<string, string> = await this.list();
    for (const name in contacts) {
      if (contacts [name] === address) { return name; }
    }
    return null;
  }

  async toAddress(name) {
    const contacts: Map<string, string> = await this.list();
    return contacts [name];
  }

  async changeName(oldName, newName) {
    const address = await this.toAddress(oldName);
    if (!address) { return; }

    await this.remove(oldName);
    await this.add({
      name: newName,
      address
    });
  }

  async remove(name) {
    const contacts: Map<string, string> = await this.list();
    delete contacts[name];

    await this.storageService.set(this.addressBookKey, contacts);
  }
}
