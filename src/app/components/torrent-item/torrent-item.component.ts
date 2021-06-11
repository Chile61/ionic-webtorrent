import filesize from 'filesize';
import moment from 'moment';
import { Component, OnInit, Input, SimpleChanges, ChangeDetectorRef, ViewChild, ViewContainerRef, OnChanges } from '@angular/core';
import { AlertController, LoadingController } from '@ionic/angular';
import { FileOpener } from '@ionic-native/file-opener/ngx';
import { Toast } from '@ionic-native/toast/ngx';
import { TorrentItem } from 'src/app/services/webtorrent/torrent-item';
import { WebtorrentService } from 'src/app/services/webtorrent/webtorrent.service';
import { FileManagerService } from 'src/app/services/webtorrent/file-manager.service';
import captureFrame from 'capture-frame';
import path from 'path';
import { File } from '@ionic-native/file/ngx';
import { Router, NavigationExtras } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { WalletService } from 'src/app/services/ocore/wallet.service';
import { Subscription } from 'rxjs';
import { EventService } from 'src/app/services/ocore/event.service';
import { showAlert } from 'src/app/library/Util';

@Component({
  selector: 'app-torrent-item',
  templateUrl: './torrent-item.component.html',
  styleUrls: ['./torrent-item.component.scss'],
})
export class TorrentItemComponent implements OnInit, OnChanges {

  private videoElement: HTMLVideoElement;
  @ViewChild('video', { static: false, read: ViewContainerRef }) set videoContent(content: any) {
    try {
      this.videoElement = content._data.renderElement;
    } catch (e) { }
  }

  private posterVideoElement: HTMLVideoElement;
  @ViewChild('posterVideo', { static: false, read: ViewContainerRef }) set posterVideoContent(content: any) {
    if (!content) {
      this.posterVideoElement = null;
    } else {
      this.posterVideoElement = content._data.renderElement;
    }
  }

  @Input()
  index: number;

  @Input()
  key: number;

  @Input()
  filterProps: Array<boolean>;

  @Input()
  visibility: boolean;

  torrentItem: TorrentItem = null;

  subscription: Subscription;
  balance = { amount: '0.0 GSC', amountNumber: 0 };

  tabIndex = -1;

  constructor(
    private router: Router,
    private toast: Toast,
    public webTorrentService: WebtorrentService,
    public fileManager: FileManagerService,
    private alertCtrl: AlertController,
    private fileOpener: FileOpener,
    public changeDetectRef: ChangeDetectorRef,
    public file: File,
    private authService: AuthService,
    public walletService: WalletService,
    private eventService: EventService,
    private loadingCtrl: LoadingController
  ) {
  }

  ngOnInit() {
    const { torrentItem } = this;
    // Poster
    torrentItem.onReadyFnc = this.onReady.bind(this);

    this.getBalance();
    this.subscription = this.eventService.ocoreEvents.subscribe((value) => {
      if (value === 'connected' || value === 'update_transaction') {
        this.getBalance();
      }
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.index) {
      this.index = changes.index.currentValue;
    }
    const key: number = (changes.key as any);
    if (changes.key
      && this.key !== key) {
      this.key = changes.key.currentValue;
      this.torrentItem = this.getTorrentItem();
    }
  }

  getTorrentItem(): TorrentItem {
    return this.webTorrentService.torrentItemList.get(this.key);
  }

  get isShowToolbar() {
    return this.torrentItem.isShowToolbar;
  }

  get address() {
    if (!this.torrentItem.isPublished) {
      return null;
    }
    return this.torrentItem.seedConfig.walletAddress;
  }

  isShow = () => this.torrentItem !== null;

  isReady() {
    const { torrentItem } = this;
    return torrentItem.isReady;
  }

  isShowByFilter() {
    if (!this.filterProps) {
      return true;
    }
    if (!this.torrentItem) {
      return false;
    }

    let isAllFalse = false;
    this.filterProps.forEach(value => isAllFalse = isAllFalse || value);
    if (!isAllFalse
      || (this.torrentItem.isPublished && this.filterProps[0])) {
      return true;
    }

    return this.filterProps[2];
  }

  getTorrentName() {
    if (this.torrentItem.torrentTitle) {
      return this.torrentItem.torrentTitle;
    }
    return this.torrentItem.torrentName;
  }

  getPercent() {
    const { torrentItem } = this;

    if (!torrentItem.torrent) { return 0; }
    return torrentItem.getDownloadPercent();
  }

  getTotalCapacity() {
    const { torrentItem } = this;
    let capacity = 0;

    if (torrentItem.torrent) {
      capacity = torrentItem.torrent.length;
    }

    return capacity ? filesize(capacity) : filesize(0);
  }

  getDownloadedCapacity() {
    const { torrentItem } = this;
    if (torrentItem.isSeeding) { return this.getTotalCapacity(); }

    const capacity = torrentItem.getDownloadSize();

    return capacity ? filesize(capacity) : filesize(0);
  }

  getPeerCount() {
    const { torrentItem } = this;
    if (torrentItem.torrent && torrentItem.torrent.numPeers) {
      return torrentItem.torrent.numPeers;
    }
    return 0;
  }

  getDownloadSpeed() {
    const { torrentItem } = this;
    let capacity = 0;
    if (torrentItem.torrent) {
      capacity = torrentItem.torrent.downloadSpeed;
    }

    return capacity ? filesize(capacity) : filesize(0);
  }

  getUploadSpeed() {
    const { torrentItem } = this;
    let capacity = 0;
    if (torrentItem.torrent) {
      capacity = torrentItem.torrent.uploadSpeed;
    }

    return capacity ? filesize(capacity) : filesize(0);
  }

  getTimeRemaining() {
    const { torrentItem } = this;
    let remainedTime = 0;
    if (torrentItem.torrent) {
      remainedTime = torrentItem.torrent.timeRemaining;
    }

    return remainedTime ? moment.duration(remainedTime / 1000, 'seconds').humanize() + ' remained' : '';
  }

  isSeeding() {
    const { torrentItem } = this;
    return torrentItem.isSeeding;
  }

  isPaused() {
    const { torrentItem } = this;
    return torrentItem.isPaused;
  }

  isIntroPaused() {
    const { torrentItem } = this;
    return torrentItem.isPaused && !torrentItem.isReady;
  }

  isPlaying() {
    const { torrentItem } = this;
    return torrentItem.isPlaying;
  }

  hasPoster() {
    const { torrentItem } = this;
    return torrentItem.posterDataURL !== null;
  }

  getPosterDataURL() {
    return this.torrentItem.posterDataURL;
  }

  onToggleItem($event) {
    const { tagName } = $event.target;
    if (tagName === 'ION-BUTTON') { return; }
    const oldValue = this.torrentItem.isShowToolbar;
    this.webTorrentService.resetToolbarStates();
    this.torrentItem.isShowToolbar = !oldValue;
    this.getBalance();
    this.onTab(-1);
  }

  onConfig() {
    const extras: NavigationExtras = {
      queryParams: {
        data: this.key
      }
    };
    this.router.navigate(['publish-config'], extras);
  }

  onPause() {
    this.torrentItem.pause();
  }

  onResume() {
    this.torrentItem.resume();
  }

  async onSave() {
    const { torrentItem } = this;

    const alert = await this.alertCtrl.create({
      header: 'Torrent file is saved.',
      message: torrentItem.torrentFilePath,
      buttons: ['Ok']
    });
    alert.present();
  }

  onOpen() {
    this.onTab(-1);
    const { torrentFilePath } = this.torrentItem;
    const torrentFileDir = path.dirname(torrentFilePath);
    this.fileOpener.open(torrentFileDir, '')
      .then(() => console.log('File is opened'))
      .catch(e => console.log('Error opening file', e));
  }

  onPlay() {
    this.onTab(-1);
    if (this.isPlaying()) { return; }
    this.webTorrentService.resetPlayingStates();
    if (this.torrentItem.torrent.files.length !== 1) { return; }

    const { torrentItem } = this;
    const { videoFilePath } = this.torrentItem;

    if (videoFilePath) {
      this.fileOpener.open(videoFilePath, 'video/mp4')
        .then(() => console.log('File is opened'))
        .catch(e => console.log('Error opening file', e));
    } else {
      torrentItem.isPlaying = true;
      this.changeDetectRef.detectChanges();
      this.torrentItem.torrent.files[0].renderTo(this.videoElement);

      this.videoElement.onloadedmetadata = (e) => {
        this.videoElement.play();
      };
    }
  }

  onStopVideo() {
    if (!this.isPlaying()) { return; }
    if (this.videoElement.pause) {
      this.videoElement.pause();
    }
    this.webTorrentService.resetPlayingStates();
  }

  async onRemove() {
    const removeActions = [
      {
        text: 'Remove only link',
        handler: () => this.removeItem()
      },
      {
        text: 'Remove torrent',
        handler: () => this.removeItem(true)
      },
      {
        text: 'Remove video, also',
        handler: () => this.removeItem(true, true)
      },
      {
        text: 'Cancel',
        role: 'cancel',
        handler: (blah) => { }
      }
    ];

    const { torrentItem } = this;

    if (this.isSeeding()
      && torrentItem.videoFilePath
      && !torrentItem.videoFilePath.startsWith(this.fileManager.appDirectory)) {
      removeActions.splice(1, 1);
    }

    const alert = await this.alertCtrl.create({
      // mode: "ios",
      backdropDismiss: true,
      header: 'Really delete it?',
      subHeader: this.getTorrentName(),
      buttons: removeActions
    });

    await alert.present();
  }

  async removeItem(isRemoveTorrentFile: boolean = false, isRemoveVideo: boolean = false) {
    const { seedConfig } = this.torrentItem;
    if (seedConfig && seedConfig.walletAddress) {
      const { amountNumber } = this.balance;
      if (!amountNumber) {
        const { videoId } = seedConfig;
        const deleteResult = await this.authService.deleteVideoById(videoId);
        if (deleteResult !== '') {
          showAlert(this.alertCtrl, deleteResult);
        }
        this.webTorrentService.destroy(this.key, isRemoveTorrentFile, isRemoveVideo);
        return;
      }

      const loadingCtrl = await this.loadingCtrl.create({
        message: 'Please wait...',
      });
      loadingCtrl.present();

      const { walletAddress } = seedConfig;
      const mainAddress = await this.walletService.getWalletAddressByIndex(0);

      this.walletService.submitPayment(
        walletAddress,
        {
          address: mainAddress,
          amount: null,
          bSendAll: true
        }, async (err) => {
          loadingCtrl.dismiss();
          if (err) {
            showAlert(this.alertCtrl, err);
          } else {
            const { videoId } = seedConfig;
            const deleteResult = await this.authService.deleteVideoById(videoId);
            if (deleteResult !== '') {
              showAlert(this.alertCtrl, deleteResult);
            }
            this.webTorrentService.destroy(this.key, isRemoveTorrentFile, isRemoveVideo);
          }
        });
    } else {
      this.webTorrentService.destroy(this.key, isRemoveTorrentFile, isRemoveVideo);
    }
  }

  async onReady() {
    if (this.hasPoster()) {
      this.removeEvents();
      return;
    }

    const { torrent } = this.torrentItem;
    if (await this.torrentItem.isPosterExist()) {
      this.torrentItem.posterFilePath = this.torrentItem.posterDownloadTargetPath;
      this.torrentItem.setPosterDataURL();
      this.removeEvents();
      return;
    }

    if (this.torrentItem.videoFilePath) {
      this.torrentItem.createPosterFromVideoFile();
      return;
    }

    this.posterVideoElement.onloadedmetadata = (e) => {
      this.posterVideoElement.play();
      this.posterVideoElement.currentTime = Math.min((this.posterVideoElement.duration || 600) * 0.03, 60);
    };
    this.posterVideoElement.volume = 0;
    this.posterVideoElement.onseeked = this.onSeeked.bind(this);

    const index = 0;
    torrent.files[index].renderTo(this.posterVideoElement, {}, (err, video) => {
      if (err) {
        this.removeEvents();
        return err;
      }
    });
  }

  removeEvents() {
    this.posterVideoElement.onloadedmetadata = (e) => { };
    this.posterVideoElement.oncanplay = () => { };
    this.posterVideoElement.onseeked = () => { };
    this.posterVideoElement.remove();
    this.torrentItem.onReadyFnc = null;
  }

  async onSeeked() {
    if (!(await this.torrentItem.hasPoster())) {
      const buf = captureFrame(this.posterVideoElement, 'jpeg');

      // unload video element
      this.posterVideoElement.pause();
      this.posterVideoElement.src = '';
      if (buf.length === 0) { return new Error('Failed'); }
      this.torrentItem.savePoster(buf);
    }
    this.removeEvents();
  }

  onTab(index: number) {
    if (index >= 0 && !this.torrentItem.isPublished) {
      this.toast.show('Sorry, you don\'t have wallet for this video.', '2000', 'bottom').subscribe();
      return;
    }
    if (index === 3) {
      const extras: NavigationExtras = {
        queryParams: {
          address: this.address,
          title: this.torrentItem.title
        }
      };
      this.router.navigate(['transaction-history'], extras);
      return;
    }
    this.tabIndex = index;
  }

  isLoggedIn() {
    return this.authService.getIsLoggedIn();
  }

  isPublishedOnSeedWeb() {
    if (this.torrentItem.seedConfig && this.torrentItem.seedConfig.isPublishOnSeedWeb) {
      return true;
    }
    return false;
  }

  isPublishedOnSeedNet() {
    if (this.torrentItem.seedConfig && this.torrentItem.seedConfig.isPublishOnSeedNet) {
      return true;
    }
    return false;
  }

  async getBalance() {
    if (!this.torrentItem.seedConfig) {
      return;
    }
    const { walletAddress } = this.torrentItem.seedConfig;
    if (!walletAddress) {
      return;
    }

    this.balance = await this.walletService.getWalletBalanceByAddress(walletAddress);
  }
}
