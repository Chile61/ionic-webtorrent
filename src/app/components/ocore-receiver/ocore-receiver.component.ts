import { Component, OnInit, EventEmitter, Output, Input } from '@angular/core';
import QRCode from 'qrcode';
import { Clipboard } from '@ionic-native/clipboard/ngx';
import { SocialSharing } from '@ionic-native/social-sharing/ngx';
import { Toast } from '@ionic-native/toast/ngx';
import { APP_NAME } from 'src/app/library/Config';

@Component({
  selector: 'app-ocore-receiver',
  templateUrl: './ocore-receiver.component.html',
  styleUrls: ['./ocore-receiver.component.scss'],
})
export class OcoreReceiverComponent implements OnInit {
  @Input()
  address: string;

  @Output() changeMainWalletTabEvent: EventEmitter<number> = new EventEmitter();

  qrCodeDataUrl = null;
  isExtended = false;

  constructor(
    private clipboard: Clipboard,
    private socialSharing: SocialSharing,
    private toast: Toast
  ) { }

  async ngOnInit() {
    const options = {};
    QRCode.toDataURL(this.address, options, (err, url) => {
      this.qrCodeDataUrl = url;
    });
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

  onClose() {
    this.changeMainWalletTabEvent.emit(-1);
  }
}
