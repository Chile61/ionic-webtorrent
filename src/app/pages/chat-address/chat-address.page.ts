import { Component, OnInit, OnDestroy } from '@angular/core';
import { Toast } from '@ionic-native/toast/ngx';
import QRCode from 'qrcode';
import { Clipboard } from '@ionic-native/clipboard/ngx';
import { SocialSharing } from '@ionic-native/social-sharing/ngx';
import {CorrespondentListService, MessageType} from 'src/app/services/ocore/correspondent-list.service';
import { LoadingController, AlertController } from '@ionic/angular';
import { showAlert, showConfirm, showPrompt, timeout } from 'src/app/library/Util';
import { Subscription } from 'rxjs';
import { EventService } from 'src/app/services/ocore/event.service';
import { BarcodeScanner } from '@ionic-native/barcode-scanner/ngx';
import { Router, NavigationExtras, ActivatedRoute } from '@angular/router';
import { NotificationService } from 'src/app/services/notification.service';
import { APP_NAME } from 'src/app/library/Config';
import breadcrumbs from 'ocore/breadcrumbs';
import chatStorage from 'ocore/chat_storage';

@Component({
  selector: 'app-chat-address',
  templateUrl: './chat-address.page.html',
  styleUrls: ['./chat-address.page.scss'],
})
export class ChatAddressPage implements OnInit, OnDestroy {
  qrCodeDataUrl = null;
  myPairAddress = '';
  pairAddress = '';

  searchKey = '';
  isExtended = false;
  isShowAddTools = false;
  isSelectedContacts = false;
  isSearching = false;

  pairedList = [];
  subscription: Subscription;
  assocLastMessage = {};
  messageType = MessageType;

  constructor(
    private clipboard: Clipboard,
    private socialSharing: SocialSharing,
    private toast: Toast,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController,
    private router: Router,
    private barcodeScanner: BarcodeScanner,
    private correspondentListService: CorrespondentListService,
    private eventService: EventService,
    private notificationService: NotificationService,
  ) { }

  async ngOnInit() {
    this.myPairAddress = await this.correspondentListService.getPairAddress();

    const options = {};
    QRCode.toDataURL(this.myPairAddress, options, (err, url) => {
      this.qrCodeDataUrl = url;
    });

    this.updatePairingAddressList();

    this.subscription = this.eventService.ocoreEvents.subscribe(value => {
      if (value !== 'update_pairing') { return; }
      this.updatePairingAddressList();
    });

    this.assocLastMessage = this.correspondentListService.assocLastMessageDateByCorrespondent;
    console.log('+++++++++', this.assocLastMessage);
  }

  ngOnDestroy() {
    this.correspondentListService.shareData = '';
    this.subscription.unsubscribe();
  }

  updatePairingAddressList() {
    this.correspondentListService.list((err, list) => {
//      console.log('list ===> ' , list);
      this.pairedList = list;
    });
  }

  onToggleAddButtons() {
    this.isShowAddTools = !this.isShowAddTools;
    this.onCancelSelect();
    this.isSearching = false;
  }

  async onAddressKeyPress(keyCode) {
    if (keyCode !== 13) { return; }

    this.startPairAddress();
  }

  async startPairAddress() {
    let loadingCtrl = await this.loadingCtrl.create({
      message: 'Pairing...',
    });

    await this.correspondentListService.handleCode(this.pairAddress, (status) => {
      if (status) { loadingCtrl.present(); } else {
        loadingCtrl.dismiss();
        loadingCtrl = null;
      }
    }).then((data) => {
      if (loadingCtrl) {
        loadingCtrl.dismiss();
      }
      timeout(this.updatePairingAddressList.bind(this));
      this.pairAddress = '';
    }).catch(err => {
      showAlert(this.alertCtrl, err);
    });
  }

  onExpandQRCode() {
    this.isExtended = true;
  }

  onCloseExtended() {
    this.isExtended = false;
  }

  onCopyAddress() {
    this.clipboard.copy(this.myPairAddress);
    this.toast.show('Pairing address was copied.', '2000', 'bottom').subscribe();
  }

  onShareAddress() {
    this.socialSharing.share(this.myPairAddress, `${APP_NAME} Pairing address`);
  }

  onScanQRCode() {
    this.barcodeScanner.scan().then(barcodeData => {
      if (barcodeData.text.length !== 0) {
        this.pairAddress = barcodeData.text;
      }
    }).catch(err => {
      console.log('Error', err);
    });
  }

  onConfirm() {
    this.startPairAddress();
  }

  filteredAddresses() {
    return this.pairedList.filter(item =>
      item.name.toLowerCase().indexOf(this.searchKey) !== -1 ||
      item.device_address.toLowerCase().indexOf(this.searchKey) !== -1)/*.sort((a,b) => {
        if (!this.assocLastMessage[a.device_address]) {
          return -1
        } else if (!this.assocLastMessage[b.device_address]) {
          return -1
        }
        else if (this.assocLastMessage[a.device_address].date < this.assocLastMessage[b.device_address].date) {
          return 1
        } else {
          return -1
        }
    })*/;
  }

  onChat(index, item, $event) {
    if (this.isSelectedContacts) {
      this.pairedList[index].isSelected = !this.pairedList[index].isSelected;
      return;
    }
    if ($event !== null) {
      const { tagName } = $event.target;
      if (tagName === 'IMG') { return; }
    }

    const extras: NavigationExtras = {
      queryParams: {
        data: JSON.stringify(item)
      }
    };
    this.router.navigate(['message'], extras);
  }

  getBadgeNum(device_address) {
    return this.notificationService.getMessageCount(device_address);
  }

  async onEdit(index, item) {
    const value = await showPrompt(this.alertCtrl, 'Rename', [{
      name: 'name',
      value: item.name,
      placeholder: 'Username'
    }]);

    if (!value) { return; }

    item.name = value.name;
    await this.correspondentListService.update(item);
    this.updatePairingAddressList();
  }

  async onRemove(index, item) {
    const result = await showConfirm(this.alertCtrl, 'Really delete them?');
    if (!result) { return; }

    const { device_address } = item;
    await this.correspondentListService.remove(device_address);
    this.updatePairingAddressList();
  }

  removeHtmlTag(html) {
    const tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  onToggleSearch() {
    this.isSearching = !this.isSearching;
    this.isShowAddTools = false;
    if (this.isSearching) {
      this.onCancelSelect();
    }
  }

  async onRemoveContacts() {
    if (!this.isSelectedContacts) { return; }

    const result = await showConfirm(this.alertCtrl, 'Really delete them?');
    if (!result) { return; }

    for (let i = this.pairedList.length - 1; i >= 0; i --) {
      const { device_address, isSelected } = this.pairedList[i];
      if (!isSelected) { continue; }
      await this.correspondentListService.remove(device_address);
    }
    this.updatePairingAddressList();
  }

  onSelectContact(i, item) {
    this.isSelectedContacts = true;
    this.pairedList[i].isSelected = true;
    this.isSearching = false;
  }

  onCancelSelect() {
    this.isSelectedContacts = false;
    this.pairedList.forEach(list => list.isSelected = false);
  }

  released() { }

  onChangeAddress($event) {}
}
