import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { AlertController } from '@ionic/angular';
import { OcoreConfigService } from 'src/app/services/ocore/ocore-config.service';
import { ProfileService } from 'src/app/services/ocore/profile.service';
import { StorageService } from 'src/app/services/ocore/storage.service';
import { Router } from '@angular/router';
import { SetDevicenamePage } from 'src/app/pages/set-devicename/set-devicename.page';
import { RequestPasswordPage } from 'src/app/pages/request-password/request-password.page';

@Component({
  selector: 'app-preferences',
  templateUrl: './preferences.page.html',
  styleUrls: ['./preferences.page.scss'],
})
export class PreferencesPage implements OnInit {
  deviceName = '';
  deviceAddress = '';
  requestPassword = false;

  constructor(
    private router: Router,
    private configService: OcoreConfigService,
    private profileService: ProfileService,
    private modalController: ModalController,
    private storageService: StorageService,
    private alertCtrl: AlertController,
  ) {
  }

  ngOnInit() {
    this.deviceName = this.configService.configCache.deviceName;
    this.deviceAddress = this.profileService.profile.my_device_address;
    this.requestPassword = this.profileService.isWalletEncryptedFC();
  }

  async onBackupWallet() {
    const walletPswd = await this.storageService.get('wallet_password', '');
    if (walletPswd !== '') {
      const alert = await this.alertCtrl.create({
        header: 'Alert',
        message: 'Backup only possible if request password is deactivated',
        buttons: ['OK'],
      });
      await alert.present();
    } else {
      this.router.navigateByUrl('backup-wallet');
      // 'backup-wallet'
    }
  }

  onRecoverWallet() {
    this.router.navigateByUrl('recover-wallet');
  }

  async onShowChangeDeviceNameDlg() {
    const modal = await this.modalController.create({
        component: SetDevicenamePage,
        componentProps: {
          deviceName: this.deviceName
        }
    });

    modal.onDidDismiss().then(res => {
      const { deviceName } = res.data;
      if (deviceName != null) {
        this.deviceName = deviceName;
        this.configService.set({deviceName}, (err) => {});
      }
    });

    return await modal.present();
  }

  async onShowRequestPasswordDlg() {
    const rp = this.profileService.isWalletEncryptedFC();
    const modal = await this.modalController.create({
      component: RequestPasswordPage,
      componentProps: {
        modalStatus: !rp
      }
    });

    modal.onDidDismiss().then(res => {
      const { result } = res.data;
      const _this = this;
      if (rp === true && result === true) {
        this.requestPassword = false;
        const fc = this.profileService.focusedClient;
        if (!fc) {
          return;
        }
        this.profileService.unlockFC(null, err => {
          if (err) {
            return;
          }
          _this.profileService.disablePrivateKeyEncryptionFC(() => {
            _this.storageService.set('isWalletPswdSet', false);
            _this.storageService.set('wallet_password', '');
          });
        });
      }
      if (rp === true && result === false) {
        this.requestPassword = true;
      }
      if (rp === false && result === true) {
        this.requestPassword = true;
      }
      if (rp === false && result === false) {
        this.requestPassword = false;
      }
    });

    return await modal.present();
  }
}
