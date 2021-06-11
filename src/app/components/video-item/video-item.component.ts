import filesize from 'filesize';
import { Component, Input, OnInit } from '@angular/core';
import { ImportVideoService } from 'src/app/services/video/import-video.service';
import { VideoItem } from 'src/app/services/video/video-item';
import { AlertController } from '@ionic/angular';
import { FileOpener } from '@ionic-native/file-opener/ngx';
import { AuthService } from 'src/app/services/auth.service';
import { NavigationExtras, Router } from '@angular/router';

@Component({
  selector: 'app-video-item',
  templateUrl: './video-item.component.html',
  styleUrls: [
    '../torrent-item/torrent-item.component.scss',
    './video-item.component.scss'],
})
export class VideoItemComponent implements OnInit {

  @Input()
  index: number;

  @Input()
  key: number;

  @Input()
  filterProps: Array<boolean>;

  @Input()
  visibility: boolean;

  videoItem: VideoItem = null;
  isShowToolbar = false;

  constructor(
    private router: Router,
    private alertCtrl: AlertController,
    private fileOpener: FileOpener,
    private importVideoService: ImportVideoService,
    private authService: AuthService,
  ) { }

  ngOnInit() {
    this.videoItem = this.importVideoService.getItemByKey(this.key);
    console.log('this.videoItem', this.videoItem);
  }

  isReady() {
    return this.videoItem.data.isDownloaded;
  }

  getTotalCapacity() {
    const { videoItem } = this;
    let capacity = 0;

    if (videoItem.data) {
      capacity = videoItem.data.capacity;
    }

    return capacity ? filesize(capacity) : filesize(0);
  }

  getDownloadedCapacity() {
    const { videoItem } = this;
    const capacity = videoItem.data.loaded;
    return capacity ? filesize(capacity) : filesize(0);
  }

  getPercent() {
    const { videoItem } = this;
    if (videoItem.data.isDownloaded) {
      return 1;
    }
    return videoItem.getDownloadPercent();
  }

  async onRemove() {
    const removeActions = [
      {
        text: 'Remove only link',
        handler: () => this.importVideoService.destroy(this.key)
      },
      {
        text: 'Remove video, also',
        handler: () => this.importVideoService.destroy(this.key, true)
      },
      {
        text: 'Cancel',
        role: 'cancel',
        handler: (blah) => { }
      }
    ];

    const { videoItem } = this;

    const alert = await this.alertCtrl.create({
      // mode: "ios",
      backdropDismiss: true,
      header: 'Really delete it?',
      subHeader: videoItem.getVideoName(),
      buttons: removeActions
    });

    await alert.present();
  }

  isLoggedIn() {
    return this.authService.getIsLoggedIn();
  }

  onConfig() {
    const extras: NavigationExtras = {
      queryParams: {
        data: this.key
      }
    };
    this.router.navigate(['publish-config'], extras);
  }

  hasPoster() {
    return this.videoItem.posterDataURL != null;
  }
  getPosterDataURL() {
    return this.videoItem.posterDataURL;
  }

  onToggleItem($event) {
    const { tagName } = $event.target;
    if (tagName === 'ION-BUTTON') { return; }
    const oldValue = this.isShowToolbar;
    this.isShowToolbar = !oldValue;
  }

  onOpen() { }

  onPlay() {
    const videoFilePath = this.videoItem.getTargetFilePath();
    if (!videoFilePath) {
      return;
    }
    this.fileOpener.open(videoFilePath, 'video/mp4')
      .then(() => console.log('File is opened'))
      .catch(e => console.log('Error opening file', e));
  }
}
