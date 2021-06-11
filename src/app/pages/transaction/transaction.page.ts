import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import moment from 'moment';
import { TxFormatService } from 'src/app/services/ocore/tx-format.service';
import { Clipboard } from '@ionic-native/clipboard/ngx';
import { Toast } from '@ionic-native/toast/ngx';
import { SocialSharing } from '@ionic-native/social-sharing/ngx';
import { WalletService } from 'src/app/services/ocore/wallet.service';
import { APP_NAME } from 'src/app/library/Config';

@Component({
  selector: 'app-transaction',
  templateUrl: './transaction.page.html',
  styleUrls: ['./transaction.page.scss'],
})
export class TransactionPage implements OnInit {
  data = null;
  myAddress;

  constructor(
    private activeRoute: ActivatedRoute,
    private clipboard: Clipboard,
    private toast: Toast,
    private txFormatService: TxFormatService,
    private walletService: WalletService,
    private socialSharing: SocialSharing,
  ) { }

  async ngOnInit() {
    this.activeRoute.queryParams.subscribe(params => {
      this.data = JSON.parse(params.data);
      this.myAddress = params.address;
    });
  }

  getAmount() {
    const { action, amountStr } = this.data;
    return (action === 'sent' ? '- ' : '') + amountStr;
  }

  onCopyFrom() {
    this.clipboard.copy(this.getAddressFrom());
    this.toast.show('Address was copied.', '2000', 'bottom').subscribe();
  }

  onShareFrom() {
    this.socialSharing.share(this.getAddressFrom(), `${APP_NAME} Address`);
  }

  onCopyTo() {
    this.clipboard.copy(this.getAddressTo());
    this.toast.show('Address was copied.', '2000', 'bottom').subscribe();
  }

  onShareTo() {
    this.socialSharing.share(this.getAddressTo(), `${APP_NAME} Address`);
  }

  onCopyId() {
    this.clipboard.copy(this.data.unit);
    this.toast.show('Address was copied.', '2000', 'bottom').subscribe();
  }

  onShareId() {
    this.socialSharing.share(this.data.unit, `${APP_NAME} Address`);
  }

  getAddressFrom() {
    const { action, arrPayerAddresses } = this.data;
    if (action === 'received') {
      return arrPayerAddresses.join(',');
    } else {
      return this.myAddress;
    }
  }

  getAddressTo() {
    const { action, my_address, addressTo } = this.data;
    if (action === 'received') {
      return my_address;
    } else {
      return addressTo;
    }
  }

  getFee() {
    const { fee, asset } = this.data;
    return this.txFormatService.formatAmountStr(fee, asset);
  }

  getDate() {
    let { time } = this.data;
    time = parseInt(time);
    const duration = moment.duration(Date.now() / 1000 - time, 'seconds').humanize();
    time = moment(time * 1000).format('lll');
    return `${time} (${duration} ago)`;
  }
}
