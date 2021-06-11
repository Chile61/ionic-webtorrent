import { NgModule } from '@angular/core';
import { BrowserModule, HAMMER_GESTURE_CONFIG } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { StatusBar } from '@ionic-native/status-bar/ngx';

import { NativeStorage } from '@ionic-native/native-storage/ngx';
import { FileChooser } from '@ionic-native/file-chooser/ngx';
import { FileOpener } from '@ionic-native/file-opener/ngx';
import { FilePath } from '@ionic-native/file-path/ngx';
import { File } from '@ionic-native/file/ngx';
import { Clipboard } from '@ionic-native/clipboard/ngx';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { ProfileService } from './services/ocore/profile.service';
import { OcoreConfigService } from './services/ocore/ocore-config.service';
import { AddressService } from './services/ocore/address.service';
import { BwcService } from './services/ocore/bwc.service';
import { EventService } from './services/ocore/event.service';
import { PreferencesGlobalService } from './services/ocore/preferences-global.service';
import { StorageService } from './services/ocore/storage.service';
import { UxLanguageService } from './services/ocore/ux-language.service';
import { Keyboard } from '@ionic-native/keyboard/ngx';
import { SocialSharing } from '@ionic-native/social-sharing/ngx';
import { Toast } from '@ionic-native/toast/ngx';
import { BarcodeScanner } from '@ionic-native/barcode-scanner/ngx';
import { Badge } from '@ionic-native/badge/ngx';
import { LocalNotifications } from '@ionic-native/local-notifications/ngx';
import { AndroidPermissions } from '@ionic-native/android-permissions/ngx';
import { NativeAudio } from '@ionic-native/native-audio/ngx';
import { Media } from '@ionic-native/media/ngx';
import { MediaCapture } from '@ionic-native/media-capture/ngx';
import { VideoEditor } from '@ionic-native/video-editor/ngx';
import { WebIntent } from '@ionic-native/web-intent/ngx';
import { FileTransfer } from '@ionic-native/file-transfer/ngx';
import { HTTP } from '@ionic-native/http/ngx';
import { BackgroundMode } from '@ionic-native/background-mode/ngx';

import { LongPressModule } from 'ionic-long-press';
import { FilterPipe } from './pipes/filter.pipe';
import { IonicGestureConfig } from '../utils/IonicGestureConfig';
import { FormsModule } from '@angular/forms';

@NgModule({
  declarations: [AppComponent, FilterPipe],
  entryComponents: [],
  imports: [
    BrowserModule,
    IonicModule.forRoot(),
    AppRoutingModule,
    HttpClientModule,
    LongPressModule,
    FormsModule
  ],
  providers: [
    StatusBar,
    SplashScreen,

    NativeStorage,
    FileChooser,
    FileOpener,
    FilePath,
    File,
    Keyboard,
    Clipboard,
    SocialSharing,
    Toast,
    BarcodeScanner,
    Badge,
    LocalNotifications,
    AndroidPermissions,
    NativeAudio,
    Media,
    MediaCapture,
    VideoEditor,
    WebIntent,

    ProfileService,
    OcoreConfigService,
    AddressService,
    BwcService,
    EventService,
    PreferencesGlobalService,
    StorageService,
    UxLanguageService,
    FileTransfer,
    HTTP,
    BackgroundMode,

    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    { provide: HAMMER_GESTURE_CONFIG, useClass: IonicGestureConfig }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
