import {Component, OnInit, OnDestroy, ViewChild, AfterViewInit} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NavController, Platform, AlertController } from '@ionic/angular';
import { NativeAudio } from '@ionic-native/native-audio/ngx';
import { CorrespondentListService } from 'src/app/services/ocore/correspondent-list.service';
import { showAlert } from 'src/app/library/Util';
import { CallService, PeerStatus } from '../../services/chat/call.service';

export enum CallType {
  Send = 0,
  Receive = 1,
}

@Component({
  selector: 'app-media-call',
  templateUrl: './media-call.page.html',
  styleUrls: ['./media-call.page.scss'],
})
export class MediaCallPage implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('videoRemoteContainer', { static: true }) videoRemoteContainer;
  private videoRemote: HTMLVideoElement;

  @ViewChild('videoMineContainer', { static: true }) videoMineContainer;
  private videoMine: HTMLVideoElement;

  ringtoneId = 'ringtone';

  data = null;
  isVideo = false;
  callType: CallType = CallType.Send;
  dotCounts = 0;
  dotInterval = null;

  isFrontCam = true;
  isMicEnabled = true;

  contactName = '';

  get statusTitle() {
    const { peerStatus } = this.callService;
    switch (peerStatus) {
      case PeerStatus.Dialing:
        return 'Dialing';
      case PeerStatus.Receiving:
        return 'Receiving' + (this.isVideo ? ' video call' : ' voice call');
      case PeerStatus.Connecting:
        return 'Connecting';
      case PeerStatus.Disconnecting:
        return 'Disconnecting';
      default:
        return '';
    }
  }

  get dots() {
    const { dotCounts } = this;
    let dots = '';
    for (let i = 0; i < dotCounts; i++) { dots += '.'; }
    return dots;
  }

  get isInCalling() {
    return this.callService.peerStatus === PeerStatus.InChat;
  }

  get isVideoCall() {
    return this.isVideo;
  }

  constructor(
      private route: ActivatedRoute,
      private router: Router,
      private navCtrl: NavController,
      private alertCtrl: AlertController,
      public callService: CallService,
      private correspondentListService: CorrespondentListService,
      private platform: Platform,
      private nativeAudio: NativeAudio) {

    this.route.queryParams.subscribe(params => {
      this.data = JSON.parse(params.data);
      this.isVideo = JSON.parse(params.isVideo);
      this.callType = Number(params.callType);
      this.init();
    });

    this.videoRemote = document.createElement('video');
    this.videoRemote.width = this.platform.width();
    this.videoRemote.height = this.platform.height();
    this.videoRemote.style.opacity = '0';
    this.videoRemote.setAttribute('autoplay', '');

    this.videoMine = document.createElement('video');
    this.videoMine.width = this.platform.width() / 4;
    this.videoMine.height = this.platform.height() / 4;
    this.videoMine.setAttribute('autoplay', '');
  }

  ngOnInit() {
  }

  ngAfterViewInit() {
    this.videoRemoteContainer.nativeElement.appendChild(this.videoRemote);
    this.videoMineContainer.nativeElement.appendChild(this.videoMine);
  }

  ngOnDestroy() {
    this.nativeAudio.stop(this.ringtoneId);
    this.callService.closeConnection();
    if (this.dotInterval) {
      clearInterval(this.dotInterval);
    }
  }

  async init() {
    this.getContactName();
    if ( this.callType === CallType.Send) {
      this.callService.signalPeer(true, this.data.device_address, this.isVideo);
    } else {
      this.callService.signalPeer(false, this.data.device_address, this.isVideo);
    }

    this.callService.onConnectionClosed = this.onConnectionClosed.bind(this);
    this.dotInterval = setInterval(() => {
      this.dotCounts++;
      if (this.dotCounts === 4) { this.dotCounts = 0; }
    }, 1000);

    this.callService.onRemoteStream = this.onRemoteStream.bind(this);
    if (this.callType === CallType.Send) {
      this.callService.onRemoteStream = this.onRemoteStream.bind(this);
    } else {
      this.nativeAudio.loop(this.ringtoneId);
    }
  }

  getContactName() {
    if (this.callType === CallType.Send) {
      this.contactName = this.data.name;
    } else {
      const { device_address } = this.data;
      this.correspondentListService.list((err, list) => {
        list.forEach(item => {
          if (item.device_address === device_address) {
            this.contactName = item.name;
          }
        });
      });
    }
  }

  onConnectionClosed() {
    this.callService.onConnectionClosed = null;
    this.navCtrl.back();
  }

  async onAcceptCall() {
    if (this.dotInterval) {
      clearInterval(this.dotInterval);
    }
    this.callService.peerStatus = PeerStatus.Connecting;
    this.nativeAudio.stop(this.ringtoneId);
    this.callService.onRemoteStream = this.onRemoteStream.bind(this);
    this.callService.addStream();
    this.startMineStream();
  }

  onDismissCall() {
    this.callService.closeConnection();
  }

  onToggleMic() {
    const audioTracks = this.callService.mineStream.getAudioTracks();
    if (!audioTracks.length) { return; }
    this.isMicEnabled = !this.isMicEnabled;
    audioTracks[0].enabled = this.isMicEnabled;
  }

  startMineStream() {
    if (this.callService.mineStream === null) { return; }

    this.videoMine.srcObject = this.callService.mineStream;
    this.videoMine.muted = true;
    this.videoMine.play();
  }

  onRemoteStream(remoteStream: MediaStream) {
    this.startMineStream();
    this.videoRemote.srcObject = remoteStream;
    this.videoRemote.play();
    setTimeout(() => {
      this.videoRemote.style.opacity = '1';
    }, 2000);
  }

  async onSwitchCam() {
    await this.callService.switchStream();
    this.videoMine.srcObject = this.callService.mineStream;
  }
}
