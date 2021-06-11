import { Component, OnInit, ChangeDetectorRef, ViewChild } from '@angular/core';
import { WebtorrentService } from 'src/app/services/webtorrent/webtorrent.service';
import { FileChooserService } from 'src/app/services/webtorrent/file-chooser.service';
import { AlertController, NavController, Platform } from '@ionic/angular';
import { Router, NavigationExtras } from '@angular/router';
import { Toast } from '@ionic-native/toast/ngx';
import { WebIntent } from '@ionic-native/web-intent/ngx';
import { showAlert, showConfirm } from 'src/app/library/Util';
import path from 'path';
import { CallType } from '../media-call/media-call.page';
import { CorrespondentListService } from 'src/app/services/ocore/correspondent-list.service';
import { APP_NAME } from 'src/app/library/Config';
import { CallService } from '../../services/chat/call.service';
import { IMPORT_TYPES } from 'src/app/library/Config';
import { ImportVideoService } from 'src/app/services/video/import-video.service';
import { FileAccountService } from 'src/app/services/file-account.service';
import { ImportYoutubeService } from 'src/app/services/video/import-youtube.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
})
export class DashboardPage implements OnInit {
  // @ViewChild('videoContainer', {static: true}) videoContainer;
  // private video: HTMLVideoElement;

  // importLink = 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_10MB.mp4';
  // importLink = 'https://www.youtube.com/watch?v=qJBUBULQpoY';
  // importLink = 'https://www.youtube.com/watch?v=1UzZUfFUnxY'; // Machine
  // importLink = 'https://www.youtube.com/watch?v=C0DPdy98e4c'; // Test
  importLink = '';

  isShowSeedWeb = true;
  isShowSeedNet = true;
  filterProps = null;
  isShowWallet = false;
  // importLink: string = "https://webtorrent.io/torrents/sintel.torrent";

  constructor(
    public webTorrentService: WebtorrentService,
    public fileAccountService: FileAccountService,
    public fileChooserService: FileChooserService,
    private toast: Toast,
    private callService: CallService,
//    private ngZone: NgZone,
    private correspondentListService: CorrespondentListService,
    private importVideoService: ImportVideoService,
    private importYoutubeService: ImportYoutubeService,
    private platform: Platform,
    public webIntent: WebIntent,
    public changeDetectRef: ChangeDetectorRef,
    private alertCtrl: AlertController,
    private router: Router) {
  }

  ngOnInit() {
    this.webTorrentService.onUpdate = () => {
      this.changeDetectRef.detectChanges();
    };
    this.listenPeerConnection();
    this.fileAccountService.load();
    this.subscribeStatus();
    this.importVideoService.webTorrentService = this.webTorrentService;
    this.webTorrentService.importVideoService = this.importVideoService;
  }

  /*  ngAfterViewInit() {
      // this.videoContainer.nativeElement.appendChild(this.video);
    }*/

  subscribeStatus() {
    this.platform.resume.subscribe(() => this.onResume());
    this.onResume();
  }

  async onResume() {
    const intent = await this.webIntent.getIntent();
    const { action, type, extras } = intent;

    if (action === 'android.intent.action.SEND' && type === 'text/plain') {
      this.correspondentListService.shareData = extras['android.intent.extra.TEXT'];
      this.router.navigateByUrl('chat-address');
    }
  }

  async onOpenFile() {
    const v_path = await this.fileChooserService.open(IMPORT_TYPES.SEEDWEB);
    if (v_path === null) { return; }

    // const fileExtention = path.extname(v_path);
    // console.dir(fileExtention);

    this.webTorrentService.openFile(v_path);
    this.importLink = '';
  }

  async onOpenLink() {
    const { importLink } = this;
    if (!this.isValidURL(importLink)) {
      this.toast.show('Torrent link is not valid.', '2000', 'bottom').subscribe();
      return;
    }

    await this.openLink(importLink);
    this.importLink = '';
  }

  async onCloseApp() {
    if (await showConfirm(this.alertCtrl, `Do you want to close ${APP_NAME}?`)) {
      (navigator as any).app.exitApp();
    }
  }

  onExpandList() {
    this.isShowWallet = false;
  }

  isValidURL(link: string) {
    let url;

    try {
      url = new URL(link);
    } catch (_) {
      return false;
    }

    return url.protocol === 'http:' || url.protocol === 'https:';
  }

  onVisibleMainWallet(status) {
    this.isShowWallet = status;
  }

  onChangeFilter(filterStatus: Array<boolean>) {
    this.isShowSeedWeb = filterStatus[0];
    this.isShowSeedNet = filterStatus[1];
    this.filterProps = filterStatus;
  }

  async openLink(link: string) {
    // 1. Torrent link
    // 2. S-Torrent link -> OK
    // 3. Magnet URL
    // 4. YouTube link
    try {
      if (this.isSTorrentFile(link)) {
        this.webTorrentService.openFile(link);
      } else if (this.importYoutubeService.isYoutubeLink(link)) {
        this.importYoutubeService.onStart(link);
      } else { // Normal video link
        const video = await this.importVideoService.loadFromLink(link);
        const metaStr = this.importVideoService.getMetaString(video);
        const metaInfo = this.importVideoService.getMetaInfo(video);
        video.remove();

        const message = `${metaStr}<br/>Do you wanna import this video?`;
        const importResult = await showConfirm(this.alertCtrl, message);
        if (!importResult) {
          return;
        }

        this.importVideoService.importVideoFromLink(link, metaInfo);
      }
    } catch (e) {
      console.log('Error in Open Link', e);
      showAlert(this.alertCtrl, 'Sorry, can not load this link.');
      return;
    }
  }

  isTorrentFile(link: string) {
    return path.extname(link).toLowerCase() === '.torrent';
  }

  isSTorrentFile(link: string) {
    return path.extname(link).toLowerCase() === '.storrent';
  }

  isMagnetLink(link: string) {
    return /^(stream-)?magnet:/.test(link);
  }

  isYoutubeLink(link: string) {
    const p = /^(?:https?:\/\/)?(?:m\.|www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})(?:\S+)?$/;
    if (link.match(p)) {
      return link.match(p)[1];
    }
    return false;
  }

  getFileAccountKeys() {
    return this.fileAccountService.getFileAccountKeys();
  }

  listenPeerConnection() {
    this.callService.onNewConnectionIncome = (conn) => {
      if (!this.router.url.includes('/media-call')) {
        const data = {
          device_address: conn.device_address,
          name: conn.label
        };
        const extras: NavigationExtras = {
          queryParams: {
            data: JSON.stringify(data),
            isVideo: conn.isVideo,
            callType: CallType.Receive,
          }
        };
        this.router.navigate(['media-call'], extras);
      }
    };
  }
}
