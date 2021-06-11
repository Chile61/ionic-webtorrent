import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { WebtorrentService } from 'src/app/services/webtorrent/webtorrent.service';
// import { RecoveryFromSeedService } from 'src/app/services/ocore/recovery-from-seed.service';
import { AuthService } from 'src/app/services/auth.service';
import { toTorrentFile as encodeTorrentFile } from 'parse-torrent';
import { Encryptor } from 'strong-cryptor';
import sha1 from 'simple-sha1';
import { Toast } from '@ionic-native/toast/ngx';
import { Clipboard } from '@ionic-native/clipboard/ngx';
import { SocialSharing } from '@ionic-native/social-sharing/ngx';
import { AlertController, LoadingController } from '@ionic/angular';
import { File } from '@ionic-native/file/ngx';
import path from 'path';
import { APP_NAME, SEED_KEY, SEED_SECRET, VIDEO_CATEGORIES, IMPORT_TYPES, DATA_URL_REPLACE } from 'src/app/library/Config';
import { showAlert, convertDataURLToImageBuffer } from 'src/app/library/Util';
import { SEEDNET_DIR, SEEDWEB_DIR, SEED_DOMAIN_WITH_HTTPS, WATCH_URL, PeerServerConfig } from 'src/app/library/Config';

import { FileChooserService } from 'src/app/services/webtorrent/file-chooser.service';
import { FileManagerService } from 'src/app/services/webtorrent/file-manager.service';
import { FileAccountService } from 'src/app/services/file-account.service';
import { TorrentWalletService } from 'src/app/services/ocore/torrent-wallet.service';
import { ProfileService } from 'src/app/services/ocore/profile.service';
import { WalletService } from 'src/app/services/ocore/wallet.service';

export interface SeedConfig {
  videoId: string;
  title: string;
  description: string;
  isAllowComments: boolean;
  isPublishOnSeedWeb: boolean;
  isPublishOnSeedNet: boolean;
  isSeedNetAllowed: boolean;
  selectedChannel: number;
  whichPrivacy: number;
  selectedCategory: number;
  hasNewImage: boolean;
  imageDataURL: string;
  linkSeedWeb: string;
  linkSeedNet: string;
  walletAddress: string;
}

@Component({
  selector: 'app-publish-config',
  templateUrl: './publish-config.page.html',
  styleUrls: ['./publish-config.page.scss'],
})
export class PublishConfigPage implements OnInit, OnDestroy {
  public textSeedWeb = SEEDWEB_DIR;
  public textSeedNet = SEEDNET_DIR;

  torrentKey: number;
  seedConfig: SeedConfig;
  videoChannels;
  privacies = [];
  videoCategories = VIDEO_CATEGORIES;
  doesInfoHashExists = true;

  constructor(
    private activeRoute: ActivatedRoute,
    private authService: AuthService,
    public fileAccountService: FileAccountService,
    public fileChooserService: FileChooserService,
    private clipboard: Clipboard,
    private toast: Toast,
    private socialSharing: SocialSharing,
    private loadingCtrl: LoadingController,
    public file: File,
    public fileManager: FileManagerService,
    public torrentWalletService: TorrentWalletService,
    public profileService: ProfileService,
    public walletService: WalletService,
    public alertCtrl: AlertController
  ) { }

  ngOnInit() {
    this.activeRoute.queryParams.subscribe(params => {
      this.torrentKey = parseInt(params.data);
      this.init();
    });
  }

  ngOnDestroy() {
    const torrentItem = this.fileAccountService.get(this.torrentKey);
    torrentItem.seedConfig = this.seedConfig;
    this.fileAccountService.webTorrentService.saveToStorage();
  }

  async init() {
    const torrentItem = this.fileAccountService.get(this.torrentKey);

    if (torrentItem.seedConfig === undefined || !torrentItem.seedConfig) {
      this.seedConfig = {
        videoId: null,
        title: torrentItem.title,
        description: torrentItem.description,
        isAllowComments: true,
        isPublishOnSeedWeb: true,
        isPublishOnSeedNet: false,
        isSeedNetAllowed: false,
        selectedChannel: 0,
        whichPrivacy: 0,
        selectedCategory: null,
        hasNewImage: false,
        imageDataURL: torrentItem.posterDataURL,
        linkSeedWeb: '',
        linkSeedNet: '',
        walletAddress: null
      };
    } else {
      this.seedConfig = torrentItem.seedConfig;
    }

    const loadingCtrl = await this.loadingCtrl.create({
      message: 'Please wait...',
    });
    loadingCtrl.present();

    this.videoChannels = await this.authService.getVideoChannels();
    const privaciesUnformated = await this.authService.getPrivacies();
    // Format privacies
    for (const [key, value] of Object.entries(privaciesUnformated)) {
      this.privacies.push(value);
    }

    // Check if infoHash exists, returns watch url if exists
//    this.doesInfoHashExists = await this.authService.checkInfoHash(torrentItem.torrent.infoHash) as any;
    const urlResult = await this.authService.urlInfoHash(torrentItem.infoHash) as any;
    if (!urlResult) {
      this.seedConfig.linkSeedWeb = null;
      this.doesInfoHashExists = false;
    } else if (urlResult[0] === undefined || urlResult[0].url === undefined) {
      this.seedConfig.linkSeedWeb = '';
      this.doesInfoHashExists = false;
    } else {
      this.seedConfig.linkSeedWeb = urlResult[0].url;
      this.doesInfoHashExists = true;
    }

    if (!this.seedConfig.isPublishOnSeedWeb && this.doesInfoHashExists) {
      let url = await this.authService.urlInfoHash(torrentItem.infoHash);
      if (url && url.length) {
        url = url[0].url;
        const videoId = this.authService.getVideoIdFromUrl(url);
        const video = await this.authService.getVideoById(videoId);

        this.seedConfig = {
          videoId,
          title: torrentItem.title,
          description: torrentItem.description,
          isAllowComments: true,
          isPublishOnSeedWeb: true,
          isPublishOnSeedNet: false,
          isSeedNetAllowed: false,
          selectedChannel: 0,
          whichPrivacy: 0,
          selectedCategory: null,
          hasNewImage: false,
          imageDataURL: this.authService.getThumbnail(video.previewPath),
          linkSeedWeb: this.authService.getVideoLinkSeedWeb(videoId),
          linkSeedNet: '',
          walletAddress: null
        };
      }
    }
    loadingCtrl.dismiss();
  }

  getCheckName(value) {
    return value ? 'checkbox-outline' : 'square-outline';
  }

  getEyeName(value) {
    return value ? 'eye-outline' : 'eye-off-outline';
  }

  onToggleAllowComments() {
    this.seedConfig.isAllowComments = !this.seedConfig.isAllowComments;
  }

  onTogglePublishOnSeedWeb() {
    this.seedConfig.isPublishOnSeedWeb = !this.seedConfig.isPublishOnSeedWeb;
  }

  onTogglePublishOnSeedNet() {
    this.seedConfig.isPublishOnSeedNet = !this.seedConfig.isPublishOnSeedNet;
  }

  onChangeVideoChannel(event: any) {
    this.seedConfig.selectedChannel = parseInt(event.target.value);
    /*
        for (const [key, value] of Object.entries(this.videoChannels)) {
          if (value['id'] === parseInt(event.target.value)) {
            this.seedConfig.isSeedNetAllowed = this.seedConfig.isPublishOnSeedNet = !value['privateChannel'];
          }
        }
    */
  }

  onChangePrivacy(event: any) {
    this.seedConfig.whichPrivacy = parseInt(event.target.value);
  }

  onChangeVideoCategory(event: any) {
    this.seedConfig.selectedCategory = event.target.value;
  }

  async OnPublish() {
    if (this.seedConfig.selectedChannel === 0) {
      showAlert(this.alertCtrl, 'Please select a video channel.');
      return;
    }
    const loadingCtrl = await this.loadingCtrl.create({
      message: 'Please wait...',
    });
    loadingCtrl.present();

    const torrentItem = this.fileAccountService.get(this.torrentKey); // TorrentItem | VideoItem
    if (!torrentItem) {
      loadingCtrl.dismiss();
      return;
    }

    // Add enhanced torrent fields
    const enhTorrent = torrentItem.torrent as any;
    enhTorrent.title = this.seedConfig.title;
    enhTorrent.comment = this.seedConfig.description;
    const pureEnhancedFile = await encodeTorrentFile(enhTorrent);

    if (this.seedConfig.hasNewImage) {
      enhTorrent.poster = await this.convertDataURLToDataString(this.seedConfig.imageDataURL);
    } else {
      enhTorrent.poster = await this.convertDataURLToDataString(torrentItem.posterDataURL);
    }

    // Genereate dataHash with new fields
    const videoInfo: any = {};
    videoInfo.title = this.seedConfig.title;
    videoInfo.duration = (torrentItem.duration === undefined ? 0 : torrentItem.duration);
    videoInfo.resolution = (torrentItem.resolution === undefined ? 0 : torrentItem.resolution);
    videoInfo.secret = SEED_SECRET;
    videoInfo.poster = enhTorrent.poster;
    enhTorrent.dataHash = await sha1.sync(Buffer.from(JSON.stringify(videoInfo)));

    const torrentFile = await encodeTorrentFile(enhTorrent);
    const encryptor = new Encryptor({ key: SEED_KEY, encryptionCount: 1 });
    const torrentStrEnc = await encryptor.encrypt(torrentFile as any);
    if (!this.seedConfig.walletAddress) {
      const address = await this.torrentWalletService.createWalletAddress();
      this.seedConfig.walletAddress = address;
    }

    // Create torrent config
    const torrentConfig = {
      infoHash: torrentItem.infoHash,
      channelId: this.seedConfig.selectedChannel,
      privacy: (this.seedConfig.whichPrivacy + 1),
      commentsEnabled: (this.seedConfig.isAllowComments ? '1' : '0'),
      category: this.seedConfig.selectedCategory,
      walletAddress: this.seedConfig.walletAddress
    };

    // If publish successfull the result is the uuid of the video
    const result = await this.authService.publishSeedWebTorrent(torrentStrEnc, torrentConfig);
//    const result = await this.authService.publishSeedNetTorrent(torrentStrEnc, torrentConfig);
    if (result !== '') {
      // Save new poster only if SeedWeb was published
      if (this.seedConfig.hasNewImage) {
        await torrentItem.savePoster(await convertDataURLToImageBuffer(this.seedConfig.imageDataURL));
      }
      // Overwrite torrent file with enhanced entries only if SeedWeb was published
      await this.saveEnhancedTorrentFile(pureEnhancedFile, torrentItem.torrentFilePath);

      this.seedConfig.videoId = result;
      this.seedConfig.linkSeedWeb = SEED_DOMAIN_WITH_HTTPS + WATCH_URL + result;
      this.doesInfoHashExists = true;
      loadingCtrl.dismiss();

      torrentItem.seedConfig = this.seedConfig;
      this.fileAccountService.webTorrentService.saveToStorage();
      showAlert(this.alertCtrl, 'Video was successfully published.');
    } else {
      this.seedConfig.linkSeedWeb = '';
      this.doesInfoHashExists = false;
      loadingCtrl.dismiss();
      showAlert(this.alertCtrl, 'Error: Video cannot be published.');
    }
  }

  onCopyLinkSeedWeb() {
    this.clipboard.copy(this.seedConfig.linkSeedWeb);
    this.toast.show(SEEDWEB_DIR + ' link was copied.', '2000', 'bottom').subscribe();
  }

  onCopyLinkSeedNet() {
    this.clipboard.copy(this.seedConfig.linkSeedNet);
    this.toast.show(SEEDNET_DIR + ' link was copied.', '2000', 'bottom').subscribe();
  }

  onCopyWalletAddress() {
    this.clipboard.copy(this.seedConfig.walletAddress);
    this.toast.show('Wallet Address was copied.', '2000', 'bottom').subscribe();
  }

  onShareLinkSeedWeb() {
    this.socialSharing.share(this.seedConfig.linkSeedWeb, `${APP_NAME} ${SEEDWEB_DIR} link`);
  }

  onShareLinkSeedNet() {
    this.socialSharing.share(this.seedConfig.linkSeedNet, `${APP_NAME} ${SEEDNET_DIR} link`);
  }

  async onOpenPoster() {
    const v_path = await this.fileChooserService.open(IMPORT_TYPES.POSTER);
    if (v_path === null) {
      this.seedConfig.hasNewImage = false;
      return;
    }

    const fileDir = path.dirname(v_path);
    const fileName = path.basename(v_path);

    // TODO, if the image bigger than 1MB show alert and return.
    await this.file.resolveLocalFilesystemUrl(v_path)
      .then((file) => {
        file.getMetadata(async (meta) => {
          console.log('File size: ' + meta.size);
          if (meta.size > 1024 * 1024) {
            showAlert(this.alertCtrl, 'Please select image less than 1MB.');
          } else {
            try {
              const tempImageDataURL = await this.file.readAsDataURL(fileDir, fileName);
              this.seedConfig.imageDataURL = tempImageDataURL;
              this.seedConfig.hasNewImage = true;
            } catch (e) {
              this.seedConfig.hasNewImage = false;
              showAlert(this.alertCtrl, 'Error: Can not open file.');
            }
          }
        }, error => { console.log('ERROR'); });
      });
  }

  async convertDataURLToDataString(uri) {
    return uri.replace(DATA_URL_REPLACE, '');
  }

  async saveEnhancedTorrentFile(pureEnhancedFile, torrentFilePath) {
    const torrentPath = path.dirname(torrentFilePath);
    const torrentFileName = path.basename(torrentFilePath);

    const blob = new Blob([pureEnhancedFile]);
    const torrentDirEntry = await this.fileManager.createDirectory(torrentPath);
    const fileEntry = await this.file.getFile(torrentDirEntry, torrentFileName, { create: true });
    const fileWriter = await this.fileManager.createFileWriter(fileEntry);
    fileWriter.truncate(0);
    fileWriter.write(blob);
  }
}
