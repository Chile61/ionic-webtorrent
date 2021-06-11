import { Component, OnInit, EventEmitter, Output, Input } from '@angular/core';
import QRCode from 'qrcode';
import { WalletService } from 'src/app/services/ocore/wallet.service';
import { Clipboard } from '@ionic-native/clipboard/ngx';
import { SocialSharing } from '@ionic-native/social-sharing/ngx';
import { Toast } from '@ionic-native/toast/ngx';
import { ProfileService } from 'src/app/services/ocore/profile.service';
import { APP_NAME } from 'src/app/library/Config';

@Component({
  selector: 'app-device-address',
  templateUrl: './device-address.component.html',
  styleUrls: ['./device-address.component.scss'],
})
export class DeviceAddressComponent implements OnInit {
  @Input()
  address: string;

  @Input()
  balance: number;

  qrCodeDataUrl = null;
  isExtended = false;

  constructor(
    private clipboard: Clipboard,
    private socialSharing: SocialSharing,
    private toast: Toast,
    private profileService: ProfileService
  ) { }

  async ngOnInit() {
    const options = {};
    QRCode.toDataURL(this.address, options, (err, url) => {
      this.qrCodeDataUrl = url;
    });
  }

  getBalance() {
    return this.profileService.formatAmountWithUnit(this.balance, 'base', { dontRound: true });
  }

  onExpandQRCode() {
    this.isExtended = true;
  }

  onCloseExtended() {
    this.isExtended = false;
  }

  onCopyAddress() {
    this.clipboard.copy(this.address);
    this.toast.show('Address was copied.', '2000', 'bottom').subscribe();
  }

  onShareAddress() {
    this.socialSharing.share(this.address, `${APP_NAME} Address`);
  }
}
