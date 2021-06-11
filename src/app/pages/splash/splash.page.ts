import { Subscription } from 'rxjs';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { VERSION_PREFIX, PEER_ID_TYPE } from 'src/app/library/Config';
import { Navigation, Router } from '@angular/router';
import { NavController, Platform } from '@ionic/angular';
import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { StatusBar } from '@ionic-native/status-bar/ngx';
import { AndroidPermissions } from '@ionic-native/android-permissions/ngx';
import { BackgroundMode } from '@ionic-native/background-mode/ngx';
import { NativeAudio } from '@ionic-native/native-audio/ngx';
import { Toast } from '@ionic-native/toast/ngx';

import { OcoreConfigService } from '../../services/ocore/ocore-config.service';
import { ProfileService } from '../../services/ocore/profile.service';
import { StorageService } from '../../services/ocore/storage.service';
import { AddressService } from '../../services/ocore/address.service';
import { WitnessService } from '../../services/ocore/witness.service';
import { WalletService } from '../../services/ocore/wallet.service';
import { CorrespondentListService } from '../../services/ocore/correspondent-list.service';
import { EventService } from 'src/app/services/ocore/event.service.js';
import { AuthService } from 'src/app/services/auth.service';
import { WebtorrentService } from 'src/app/services/webtorrent/webtorrent.service';
import { FileManagerService } from 'src/app/services/webtorrent/file-manager.service';
import { CallService } from 'src/app/services/chat/call.service';
import { sleep } from 'src/app/library/Util';

@Component({
  selector: 'app-splash',
  templateUrl: './splash.page.html',
  styleUrls: ['./splash.page.scss'],
})
export class SplashPage implements OnInit, OnDestroy {
  isVisible = true;
  timerId;
  subscription: Subscription;
  dotCount = 4;

  isConnected = false;
  isProfileDone = false;

  constructor(
    private navCtrl: NavController,
    private router: Router,
    private platform: Platform,
    private splashScreen: SplashScreen,
    private statusBar: StatusBar,

    private configService: OcoreConfigService,
    private profileService: ProfileService,
    private addressService: AddressService,
    private walletService: WalletService,
    private storageService: StorageService,
    private witnessService: WitnessService,
    public fileService: FileManagerService,
    private correspondentListService: CorrespondentListService,
    private authService: AuthService,
    private eventService: EventService,
    private nativeAudio: NativeAudio,
    private toast: Toast,
    public webTorrentService: WebtorrentService,
    public webTorrentServiceNet: WebtorrentService,
    public callService: CallService,
    private androidPermissions: AndroidPermissions,
    private backgroundMode: BackgroundMode
  ) {
  }

  ngOnInit() {
    this.platform.ready().then(async (value) => {
      this.init();
      this.correspondentListService.init();
      this.nativeAudio.preloadSimple('ringtone', 'assets/sounds/ringtone.mp3');
    }).catch(e => {
    });
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    clearInterval(this.timerId);
  }

  async init() {
    this.timerId = setInterval(() => {
      // this.isVisible = !this.isVisible;
      this.dotCount--;
      if (this.dotCount === -1) { this.dotCount = 4; }
    }, 1000);

    await this.askStoragePermission();
    try {
      await this.authService.getClient();
    } catch (e) {}
    await this.authService.loadLoginStatus();
    await this.configService.initConfig();
    await this.fileService.init();
    await this.backgroundMode.enable();

    this.initializeApp();

    const connectWaiter = setTimeout(() => {
      this.isConnected = true;
      this.toast.show('Network connection is failed. You can only see data.', '2000', 'bottom').subscribe();
      this.onCompleted();
    }, 5000);

    this.eventService.init();
    this.subscription = this.eventService.ocoreEvents.subscribe(value => {
      if (value !== 'connected') { return; }
      this.isConnected = true;
      clearTimeout(connectWaiter);
      this.onCompleted();
    });
  }

  async onCompleted() {
    if (!this.isProfileDone || !this.isConnected) { return; }

    this.webTorrentService.init(PEER_ID_TYPE.PEER_ID_40);
//    this.webTorrentServiceNet.init(PEER_ID_TYPE.PEER_ID_40, true);

    await this.callService.init();

    const autoLogin = await this.storageService.get('AUTO_LOGIN', false);
    if (autoLogin) {
      console.log('AutoLogin True');
      await this.authService.getClient();

      const loginCredential = await this.storageService.get('AUTH_CREDENTIAL', null);
      if (loginCredential == null) {
        console.log('Auto LoginCredential Empty');
        this.navCtrl.navigateRoot('dashboard');
        return;
      }

      const result = await this.authService.do(loginCredential.username, loginCredential.password);
      if (!result) {
        console.log('Login Failed');
        this.navCtrl.navigateRoot('log-in');
        return;
      }

      console.log('Auto Log-in Success');

      const DEVICE_ID = this.profileService.profile.my_device_address;
      const loginResult = this.authService.setDeviceIdAndVersion(DEVICE_ID, VERSION_PREFIX);

      if (loginResult) { this.authService.saveLoginCredential(); }

      this.navCtrl.navigateRoot('dashboard');

    } else {
      console.log('AutoLogin False');
      this.authService.logout();
      this.navCtrl.navigateRoot('dashboard');
    }
  }

  getSyncTitle() {
    let temp = this.dotCount;
    let title = 'syncronization';
    while (temp !== 0) {
      title = '.' + title;
      temp--;
    }
    return title;
  }

  initializeApp() {
    this.statusBar.overlaysWebView(false);
    this.statusBar.backgroundColorByHexString('#416793');
    this.splashScreen.hide();

    this.storageService.getDisclaimerFlag((err, val) => {
      if (!val) {
        const noWallet = false;
        this.profileService.create({ noWallet }, (_err) => {
          if (_err) { return; }
          this.onProfileDone();
        });
        return;
      }

      this.profileService.loadProfile((_err) => {
        if (_err) { return; }
        this.onProfileDone();
      });
    });
  }

  onProfileDone() {
    this.witnessService.init();
    this.walletService.profileService = this.profileService;
    this.walletService.init();

    this.addressService.getWalletAddress((address) => {
      console.log('getWalletAddress  ' + address);
    });

    this.isProfileDone = true;
    this.onCompleted();
  }

  async askStoragePermission() {
    let hasPermission = false;
    while (!hasPermission) {
      try {
        const result = await this.androidPermissions.checkPermission(this.androidPermissions.PERMISSION.WRITE_EXTERNAL_STORAGE);
        if (result && result.hasPermission) {
          hasPermission = result.hasPermission;
        }
      } catch (e) {}
      if (hasPermission) { break; }
      this.androidPermissions.requestPermissions([this.androidPermissions.PERMISSION.WRITE_EXTERNAL_STORAGE])
        .then(() => {})
        .catch(() => {});
      sleep(2000);
    }
  }
}
