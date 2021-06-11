import { Injectable } from '@angular/core';
import ytdl, { videoFormat } from 'ytdl-core';
import { HTTP } from '@ionic-native/http/ngx';
import { AlertController, LoadingController } from '@ionic/angular';
import { APP_NAME } from 'src/app/library/Config';
import { ImportVideoService } from './import-video.service';
import { VideoType } from './video-item';

@Injectable({
  providedIn: 'root'
})
export class ImportYoutubeService {
  importVideoService: ImportVideoService = null;

  constructor(
    private http: HTTP,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController
  ) { }

  isYoutubeLink = async (link) => {
    const res = await ytdl.validateURL(link);
    return ytdl.validateURL(link);
  }

  onStart = async (link) => {
    const loadingCtrl = await this.loadingCtrl.create({
      message: 'Getting video data...',
    });
    loadingCtrl.present();
    try {
      const { videoDetails, videoFormats } = await this.getInfo(link);
      const { title, thumbnails, description } = videoDetails;
      this.loadingCtrl.dismiss();
      const thumbnailUrl = thumbnails[0].url;

      const buttons = videoFormats.map((videoFormatProp) => {
        const {
          width, height, qualityLabel
        } = videoFormatProp;
        return {
          text: `${qualityLabel} (${width}x${height})`,
          handler: () => this.startDownload(link, title, description, thumbnailUrl, videoFormatProp)
        };
      });

      const alert = await this.alertCtrl.create({
        header: APP_NAME,
        message: title,
        buttons
      });
      await alert.present();

    } catch (error) {
      console.log('Youtube Error', error);
    } finally {
      this.loadingCtrl.dismiss();
    }
  }

  getInfo = async (link) => {
    const videoInfo = await ytdl.getInfo(link, {
      requestOptions: {
        maxRetries: 0,
        requestFnc: (url, options) => ({
          text: () => new Promise((resolve, reject) => {
            this.http.get(url, {}, {})
              .then(({ data }) => resolve(data))
              .catch(error => reject(error));
          })
        })
      }
    });

    const { formats, videoDetails } = videoInfo;
    const videoFormats = formats
      .filter(({ hasVideo, hasAudio }) => hasVideo && hasAudio)
      .sort(({ qualityLabel: a }, { qualityLabel: b }) => {
        const aVal = parseInt(a);
        const bVal = parseInt(b);
        if (aVal > bVal) { return -1; }
        if (aVal < bVal) { return 1; }
        return 0;
      });

    for (let i = videoFormats.length - 1; i > 0; i--) {
      if (videoFormats[i].qualityLabel === videoFormats[i - 1].qualityLabel) {
        videoFormats.splice(i, 1);
      }
    }

    return {
      videoDetails,
      videoFormats
    };
  }

  startDownload = (link, title, description, thumbnailUrl, videoFormatProp: videoFormat) => {
    this.importVideoService.importVideoFromLink(link, {
      title,
      width: videoFormatProp.width,
      height: videoFormatProp.height,
      videoUrl: videoFormatProp.url,
      qualityLabel: videoFormatProp.qualityLabel,
      duration: parseInt(videoFormatProp.approxDurationMs) / 1000,
      type: VideoType.Youtube,
      thumbnailUrl,
      extName: videoFormatProp.container,
      capacity: videoFormatProp.contentLength,
      description
    });
  }
}
