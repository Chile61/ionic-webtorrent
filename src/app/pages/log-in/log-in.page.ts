import { Component, OnInit } from '@angular/core';
import { APP_NAME, VERSION_PREFIX } from 'src/app/library/Config';
import { NavController } from '@ionic/angular';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';

import { AuthService } from 'src/app/services/auth.service';
import { ProfileService } from 'src/app/services/ocore/profile.service';
import { StorageService } from 'src/app/services//ocore/storage.service';

@Component({
  selector: 'app-log-in',
  templateUrl: './log-in.page.html',
  styleUrls: ['./log-in.page.scss'],
})
export class LogInPage implements OnInit {
  public appName = APP_NAME;

  loginForm: FormGroup;
  isSubmitted = false;
  isLoading = false;

  get errorControl() {
    return this.loginForm.controls;
  }

  constructor(
    private navCtrl: NavController,
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private profileService: ProfileService,
    private storageService: StorageService
  ) { }

  ngOnInit() {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required]],
      password: ['', []],
      autoLogin: [false, []],
    });

    const _this = this;
    this.storageService.get('AUTO_LOGIN', false).then(autoLgIn => {
      _this.storageService.get('AUTH_CREDENTIAL', null).then(loginCredential => {
        _this.loginForm.setValue({
          email: autoLgIn && loginCredential ? loginCredential.username : '',
          password: autoLgIn && loginCredential ? loginCredential.password : '',
          autoLogin: autoLgIn,
        });
      });
    });
  }

  async onSignIn() {
    this.isSubmitted = true;
    if (!this.loginForm.valid) {
      console.log('Please provide all the required values!');
      return false;
    }

    this.isLoading = true;
    await this.authService.getClient();

    const { email, password, autoLogin } = this.loginForm.value;
    const result = await this.authService.do(email, password);

    this.isLoading = false;
    if (!result) { return; }

    const DEVICE_ID = this.profileService.profile.my_device_address;
    const loginResult = this.authService.setDeviceIdAndVersion(DEVICE_ID, VERSION_PREFIX);

    if (loginResult) { this.authService.saveLoginCredential(); }

    this.storageService.set('AUTO_LOGIN', autoLogin);

    this.navCtrl.navigateRoot('dashboard');
  }

  onBack() {
    this.navCtrl.navigateRoot('dashboard');
  }
}
