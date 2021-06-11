import { Component, OnInit, Output, EventEmitter, Input, ViewChild, SimpleChanges } from '@angular/core';
import { WalletService } from 'src/app/services/ocore/wallet.service';
import { Router } from '@angular/router';
import { EventService } from '../../services/ocore/event.service';
import { AlertController, LoadingController } from '@ionic/angular';
import { showAlert, showConfirm } from 'src/app/library/Util';
import { AddressBookService } from 'src/app/services/address-book.service';
import { ProfileService } from 'src/app/services/ocore/profile.service';
import { BarcodeScanner } from '@ionic-native/barcode-scanner/ngx';
import { StorageService } from 'src/app/services/ocore/storage.service';
import { Toast } from '@ionic-native/toast/ngx';

@Component({
  selector: 'app-ocore-sender',
  templateUrl: './ocore-sender.component.html',
  styleUrls: ['./ocore-sender.component.scss'],
})
export class OcoreSenderComponent implements OnInit {
  @Input()
  address: string;

  @Input()
  defaultAddress: string;

  @Output() changeMainWalletTabEvent: EventEmitter<number> = new EventEmitter();

  isValidAddress = false;
  isSendAll = false;
  receiverAddress = '';

  amount;
  totalAmount = 0;
  totalAmountString = '';
  sendAllButtonColor = 'light';

  constructor(
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private toast: Toast,
    private router: Router,
    private eventService: EventService,
    private addressBookService: AddressBookService,
    private profileService: ProfileService,
    private walletService: WalletService,
    private barcodeScanner: BarcodeScanner,
    private storageService: StorageService,
  ) { }

  ngOnInit() {
    this.eventService.on('onSelectAddress', (address) => {
      this.receiverAddress = address;
      this.onChangeAddress();
    });

    this.walletService.getWalletBalanceByAddress(this.address).then(balance => {
      if (balance === null) { return; }
      const { amount, asset, amountNumber } = balance;

      this.totalAmount = this.profileService.formatAmount(amountNumber, asset, { dontRound: true });
      this.totalAmountString = amount;
    });
  }

  onAddressBook() {
    this.router.navigateByUrl('address-book');
  }

  onScanQRCode() {
    this.barcodeScanner.scan().then(barcodeData => {
      if (barcodeData.text.length !== 0) {
        this.receiverAddress = barcodeData.text;
        this.onChangeAddress();
        if (!this.isValidAddress) {
          showAlert(this.alertCtrl, 'Invalid address.');
        }
      }
    }).catch(err => {
      console.log('Error', err);
    });
  }

  async onSaveAddress() {
    this.onChangeAddress();
    if (!this.isValidAddress) {
      showAlert(this.alertCtrl, 'This is not valid address.');
      return;
    }

    if (await this.addressBookService.toName(this.receiverAddress)) {
      showAlert(this.alertCtrl, 'The address already exists.');
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Address Name',
      inputs: [
        {
          name: 'name',
          value: '',
          placeholder: 'Username'
        },
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          handler: data => {
            console.log('Cancel clicked');
          }
        },
        {
          text: 'Save',
          handler: data => {
            if (!data.name) { return false; }
            // Save new address & name
            this.addressBookService.addWithAlert({
              name: data.name,
              address: this.receiverAddress
            }, this.alertCtrl);
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  onChangeAddress() {
    this.isValidAddress = this.walletService.isValidAddress(this.receiverAddress);
  }

  onInput(event: any) {
    // Remove first dot, replace all but 0-9 and dot, replace 2nd dot
    const cleanAmount = event.target.value.replace(/^\./, '').replace(/[^\d*\.?\d*]/g, '').replace(/^(\d*\.?)|(\d*)\.?/g, '$1$2');
    if (!cleanAmount) {
      event.target.value = '';
      return;
    }
    const newAmount = this.profileService.formatInputAmount(cleanAmount) as string;
    const amountElement = document.getElementById('amount') as HTMLInputElement;
    amountElement.value = newAmount;

    /* This code does not work anymore
       event.target.value = newAmount; */
  }

  onChangeSendAll() {
    this.isSendAll = !this.isSendAll;

    if (this.isSendAll) {
      // Amount element must clean to show placeholder string
      const amountElement = document.getElementById('amount') as HTMLInputElement;
      amountElement.value = '';
      this.totalAmountString = 'Total amount minus fees';
      this.sendAllButtonColor = 'danger';
    } else {
      this.walletService.getWalletBalanceByAddress(this.address).then(balance => {
        if (balance === null) { return; }
        const { amount, asset, amountNumber } = balance;

        this.totalAmountString = amount;
        this.totalAmount = this.profileService.formatAmount(amountNumber, asset, { dontRound: true });
        this.sendAllButtonColor = 'light';
      });
    }
  }

  async _onSend(alertData) {
    const walletPswd = await this.storageService.get('wallet_password', '');

    if (walletPswd === alertData.pswd) {
      this.onChangeAddress();
      if (!this.isValidAddress) {
        showAlert(this.alertCtrl, 'Invalid address!');
        return;
      }

      if (this.isSendAll) {
        const result = await showConfirm(this.alertCtrl, 'Really send all?');
        if (!result) { return; }
      } else {
        const amount = parseFloat(this.amount.toString().replace(/ |G|S|C/g, ''));

        if (amount > this.totalAmount || !amount) {
          showAlert(this.alertCtrl, 'Invalid amount!');
          // this.amountElement.focus();
          return;
        }
      }
      const loadingCtrl = await this.loadingCtrl.create({
        message: 'Please wait...',
      });
      loadingCtrl.present();

      this.walletService.submitPayment(
        this.address,
        {
          address: this.receiverAddress,
          amount: (this.isSendAll ? null : this.amount),
          bSendAll: this.isSendAll
        }, (err) => {
          loadingCtrl.dismiss();
          if (err) {
            showAlert(this.alertCtrl, err);
          }
          if (!err) { this.changeMainWalletTabEvent.emit(3); }
        });
    } else {
      const alert1 = await this.alertCtrl.create({
        cssClass: 'my-custom-class',
        header: 'Error',
        message: 'Wrong Wallet Password. Try again',
        buttons: ['OK']
      });

      await alert1.present();
    }
  }

  async onSend() {
    const _this = this;
    const alert = await this.alertCtrl.create({
      cssClass: 'nmy-custom-css',
      header: 'Enter your wallet password',
      inputs: [
        {
          name: 'pswd',
          type: 'password',
          placeholder: 'Input your wallet password'
        },
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          cssClass: 'secondary',
          handler: () => {
            return;
          }
        }, {
          text: 'Ok',
          handler: async (alertData) => {
            _this._onSend(alertData);
          }
        }
      ]
    });

    const rwp = await this.storageService.get('isWalletPswdSet', false);
    if (rwp === true) {
      await alert.present().then(() => {
        const firstInput: any = document.querySelector('ion-alert input');
        firstInput.focus();
        return;
      });
    } else {
      const walletPswd = await this.storageService.get('wallet_password', '');
      _this._onSend({ pswd: walletPswd });
    }
  }
}
