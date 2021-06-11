import { Component, OnInit } from '@angular/core';

import { Platform, NavController } from '@ionic/angular';
import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { VERSION, APP_NAME } from './library/Config';
import { Router, RouterEvent } from '@angular/router';
import { ProfileService } from './services/ocore/profile.service';
import { OcoreConfigService } from './services/ocore/ocore-config.service';
import { EventService } from './services/ocore/event.service';
import { AuthService } from './services/auth.service';
// import { Badge } from '@ionic-native/badge';
import { File } from '@ionic-native/file/ngx';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss']
})
export class AppComponent implements OnInit {
  public appName = APP_NAME;
  public selectedIndex = 0;
  public appPages = [
    {
      title: 'Dashboard',
      url: 'dashboard',
      icon: 'home',
      isVisible: () => true
    },
    {
      title: 'Preferences & Backup',
      url: 'preferences',
      icon: 'cog',
      isVisible: () => true
    },
    {
      title: 'Login',
      url: 'log-in',
      icon: 'log-in',
      isVisible: () => !this.authService.getIsLoggedIn()
    },
    {
      title: 'Logout',
      url: 'log-out',
      icon: 'log-out',
      isVisible: () => this.authService.getIsLoggedIn()
    },
  ];
  public labels = ['Family'];

  public version: string = VERSION;

  constructor(
    private router: Router,
    public navCtrl: NavController,
    private configService: OcoreConfigService,
    private eventService: EventService,
    private authService: AuthService,
    // private badge: Badge
  ) {
  }

  ngOnInit() {
    this.eventService.init();

    if (!this.configService.configCache) {
      this.router.navigateByUrl('splash');
    }
    // this.badge.set(2);
  }

  get isNowSplash() {
    return this.router.url === '/splash';
  }

  onSelect(index) {
    this.selectedIndex = index;
    const { url } = this.appPages[index];

    if (url === 'log-out') {
      this.authService.logout();
      this.authService.saveLoginCredential();
      return;
    }
    this.router.navigateByUrl(url);
  }
}
