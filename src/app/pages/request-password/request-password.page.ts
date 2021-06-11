import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { IonInput, ModalController } from '@ionic/angular';
import { Validators, FormBuilder, FormGroup } from '@angular/forms';
import { ProfileService } from 'src/app/services/ocore/profile.service';
import { StorageService } from 'src/app/services/ocore/storage.service';

@Component({
  selector: 'app-request-password',
  templateUrl: './request-password.page.html',
  styleUrls: ['./request-password.page.scss'],
})
export class RequestPasswordPage implements OnInit, AfterViewInit {
  modalStatus;
  passwordMisMatch = false;
  @ViewChild('pswdInput', {static: false}) ionInput: { setFocus: () => void; };

  public requestPasswordForm: FormGroup;
  constructor(
    private formBuilder: FormBuilder,
    private modalController: ModalController,
    private profileService: ProfileService,
    private storageService: StorageService,
  ) { }

  ngOnInit() {
    this.requestPasswordForm = this.formBuilder.group({
      pswd: ['', Validators.required],
      confirmPswd: ['', Validators.required],
    });
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.ionInput.setFocus();
    }, 400);
  }

  dismiss(res) {
    this.modalController.dismiss({
      result: res
    });
  }

  async onSet() {
    const { pswd, confirmPswd } = this.requestPasswordForm.value;
    if (this.modalStatus === true) {
      if (pswd === confirmPswd && pswd !== '') {
        this.profileService.setPrivateKeyEncryptionFC(pswd, () => console.log('Wallet Encrypted Done'));
        this.storageService.set('isWalletPswdSet', true);
        this.storageService.set('wallet_password', pswd);
        this.dismiss(true);
      } else {
        this.passwordMisMatch = true;
      }
    } else {
      const walletPswd = await this.storageService.get('wallet_password', '');
      const res = pswd === walletPswd;
      if (res === true) {
        this.dismiss(true);
      } else {
        this.dismiss(false);
      }
    }
  }
}
