import { Component, OnInit } from '@angular/core';
import { AlertController, NavController } from '@ionic/angular';
import { SocialSharing } from '@ionic-native/social-sharing/ngx';
import { EventService } from 'src/app/services/ocore/event.service';
import { AddressBookService } from 'src/app/services/address-book.service';
import { WalletService } from 'src/app/services/ocore/wallet.service';
import { Toast } from '@ionic-native/toast/ngx';
import { APP_NAME } from 'src/app/library/Config';

@Component({
  selector: 'app-address-book',
  templateUrl: './address-book.page.html',
  styleUrls: ['./address-book.page.scss'],
})
export class AddressBookPage implements OnInit {

  constructor(
    private navCtrl: NavController,
    private alertCtrl: AlertController,
    private eventService: EventService,
    private addressBookService: AddressBookService,
    private socialSharing: SocialSharing,
    private toast: Toast,
    private walletService: WalletService
  ) {
  }
  searchKey = '';    // Search for key

  outAddresses = [];
  onSelect = () => { };

  ngOnInit() {
    this.setOutAddress();
  }

  async setOutAddress() {
    const contacts = await this.addressBookService.list();
    this.outAddresses = [];
    for (const name in contacts) {
      if (contacts.hasOwnProperty(name)) {
        this.outAddresses.push({
          name,
          address: contacts[name]
        });
      }
    }
    this.outAddresses = this.outAddresses.sort((item1, item2) => {
      const a = item1.name.toLowerCase();
      const b = item2.name.toLowerCase();
      if (a > b) {
        return 1;
      }
      if (b > a) {
        return -1;
      }
      return 0;
    });
  }

  async onAddAddress() {
    const alert = await this.alertCtrl.create({
      header: 'Address Name',
      inputs: [
        {
          name: 'name',
          value: '',
          placeholder: 'Username'
        },
        {
          name: 'address',
          value: '',
          placeholder: 'Address'
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
          handler: async data => {
            const { name, address } = data;
            if (!name) { return false; }

            const isValid = this.walletService.isValidAddress(address);
            if (!isValid) {
              this.toast.show('The address is not valid.', '2000', 'bottom').subscribe();
              return false;
            }
            await this.addressBookService.add({
              name,
              address
            });
            this.setOutAddress();
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  onClickAddress($event, item) {
    const { tagName } = $event.target;
    if (tagName === 'ION-BUTTON') { return; }

    this.eventService.emit('onSelectAddress', item.address);
    this.navCtrl.back();
  }

  filteredOutAddresses() {
    return this.outAddresses.filter(item =>
      item.name.toLowerCase().indexOf(this.searchKey) !== -1 ||
      item.address.toLowerCase().indexOf(this.searchKey) !== -1);
  }

  onShare(index, item) {
    this.socialSharing.share(item.address, `${APP_NAME} Address`);
  }

  async onEdit(index, item) {
    const alert = await this.alertCtrl.create({
      header: 'Address Name',
      inputs: [
        {
          name: 'name',
          value: item.name,
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
          handler: async data => {
            if (!data.name) { return false; }
            const oldName = this.outAddresses[index].name;
            await this.addressBookService.changeName(oldName, data.name);
            this.setOutAddress();
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  async onRemove(index, item) {
    const alert = await this.alertCtrl.create({
      header: 'Confirm',
      message: 'Really delete them?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          cssClass: 'secondary',
          handler: (blah) => {
          }
        }, {
          text: 'Okay',
          handler: async () => {
            await this.addressBookService.remove(item.name);
            this.setOutAddress();
          }
        }
      ]
    });

    await alert.present();
  }
}
