import { Injectable } from '@angular/core';
import SimplePeer from 'simple-peer';
import device from 'ocore/device.js';
import {Platform} from '@ionic/angular';
import {ProfileService} from '../ocore/profile.service';
import {OcoreConfigService} from '../ocore/ocore-config.service';
import {AndroidPermissions} from '@ionic-native/android-permissions/ngx';
import {SignalServerConfig, PeerServerConfig, PeerServerConfigFallback} from 'src/app/library/Config';
import Peer from 'peerjs';
import { sleep } from 'src/app/library/Util';
import { Toast } from '@ionic-native/toast/ngx';

export enum PeerStatus {
  Free = 0,
  Dialing = 1,
  Receiving = 2,
  Connecting = 3,
  InChat = 4,
  Disconnecting = 5,
  ReceivingSignal = 6,
}

export enum StatusCommands {
  connClose = 'FC',
  callAudio = 'FA',
  callVideo = 'FV',
  callBusy = 'FN',
  callReady = 'FY'
}

export enum PeerDataType {
  Status = 0,
}

export enum ConnectResult {
  Success = 0,
  ERR_MediaStream,
  ERR_CON_EXIST,
}

@Injectable({
  providedIn: 'root'
})
export class CallService {
    mineStream: MediaStream;
    peer: any;
    isVideo = true;
    callIncomming: any;
    callOutgoing: any;
    signalConn: any;
    hasSignalConn = false;
    hasConnType = false;
    isInitiator = false;
    to_device_address: any;
    signalingCanceled = false;
    timerConn = null;
    deviceId: string;
    hasCamPermission = false;
    hasAudioPermission = false;

    peerStatus: PeerStatus = PeerStatus.Free;
    onNewConnectionIncome: (conn) => void;
    onRemoteStream: (remoteStream) => void;
    onConnectionClosed: () => void;

    rearCam = false;

    get deviceName() {
      return this.configService.configCache.deviceName;
    }

    constructor(
      private platform: Platform,
      private configService: OcoreConfigService,
      public profileService: ProfileService,
      private androidPermissions: AndroidPermissions,
      private toast: Toast,
  ) { }

    async init() {
        this.peer = null;
        this.deviceId = this.profileService.profile.my_device_address;
        this.connectToPeer();
        this.setConnTimer();

        await this.getCamPermission();
        await this.getAudioPermission();
    }

    connectToPeer() {
      this.peer = new Peer(this.deviceId, PeerServerConfig);
      this.peer.on('connection', async (conn) => {
        conn.on('data', async (data) => {
          const command = data.slice(0, 2);
          switch (command) {
            case StatusCommands.connClose:  // Close call connection
              this.signalingCanceled = true;
              this.closeConnection(false);
              break;
            case StatusCommands.callAudio:  // Info audio call
            case StatusCommands.callVideo:  // Info video call
// The following event is not called on all Android versions.
              conn.on('open', async () => {
                if (this.signalingCanceled) {
                  this.closeConnection(false);
                } else {
                  if (this.peerStatus === PeerStatus.InChat) {
                    conn.send(StatusCommands.callBusy);
                  } else {
                    this.peerStatus = PeerStatus.ReceivingSignal;
                    this.hasConnType = true;
                    this.isVideo = (command === StatusCommands.callVideo ? true : false);
                    conn.send(StatusCommands.callReady);
                  }
                }
              });
              break;
          }
        });
      });
      this.peer.on('call', async call => {
        this.callIncomming = call;
        if (this.peerStatus === PeerStatus.ReceivingSignal) {
          this.peerStatus = PeerStatus.Receiving;
          this.onNewConnectionIncome({device_address: call.peer, label: '', isVideo: this.isVideo});
        }
      });
    }

    setConnTimer() {
      this.timerConn = setInterval(() => {
        if (this.peer._open === false ) {
          this.peer.destroy();
          this.connectToPeer();
        }
      }, 5000);
    }


    async getCamPermission() {
        await this.androidPermissions.checkPermission(this.androidPermissions.PERMISSION.CAMERA).then(
            async err => {
                this.androidPermissions.requestPermission(this.androidPermissions.PERMISSION.CAMERA);
            }
        );

        const result = await this.androidPermissions.requestPermissions([this.androidPermissions.PERMISSION.CAMERA]);
        if (result && result.hasPermission) {
          this.hasCamPermission = result.hasPermission;
        }
    }

    async getAudioPermission() {
        await this.androidPermissions.checkPermission(this.androidPermissions.PERMISSION.RECORD_AUDIO).then(
            async err => {
                this.androidPermissions.requestPermission(this.androidPermissions.PERMISSION.RECORD_AUDIO);
            }
        );

        const result = await this.androidPermissions.requestPermissions([this.androidPermissions.PERMISSION.RECORD_AUDIO]);
        if (result && result.hasPermission) {
          this.hasAudioPermission = result.hasPermission;
        }
    }

    getMediaStream(): Promise<MediaStream> {
        return new Promise(async (resolve, reject) => {
            const video = (this.isVideo ? {
                                        facingMode: {
                                            exact: this.rearCam ? 'environment' : 'user'
                                        }
                                      }
                                      : false );
            const constraints = {
                video: video,
                audio: true
            };

            const handleSuccess = (stream: MediaStream) => resolve(stream);
            const handleError = (error: any) => {
                alert('Camera Handle Error: ' + JSON.stringify(error));
                resolve(null);
            };
            if (this.mineStream) {
                this.mineStream.getTracks().forEach(track => track.stop());
            }
            navigator.mediaDevices.getUserMedia(constraints).then(handleSuccess).catch(handleError);
        });
    }

    async signalPeer(initiator = false, to_device_address, isVideo) {
        this.isVideo = isVideo;
        this.isInitiator = initiator;
        this.mineStream = await this.getMediaStream();
        if (this.mineStream === null) {
            return ConnectResult.ERR_MediaStream;
        }

        this.signalConn = this.peer.connect(to_device_address);
        this.signalConn.on('open', async () => {
          this.hasSignalConn = true;
          this.to_device_address = to_device_address;
          if (this.isInitiator) {
            if (this.isVideo) {
              this.signalConn.send(StatusCommands.callVideo);
            } else {
              this.signalConn.send(StatusCommands.callAudio);
            }
          }
        });
        this.signalConn.on('data', async (data) => {
            const command = data.slice(0, 2);
            switch (command) {
              case StatusCommands.callReady:  // Allow to connect
                this.callPeer();
                break;
              case StatusCommands.callBusy:  // Not allow to connect
                this.toast.show('Busy', '2000', 'bottom').subscribe();
                this.closeConnection(false);
                break;
            }
        });
/*
        this.signalConn.on('close', function() {
        });
*/
        this.signalConn.on('error', function(err) {
            this.hasSignalConn = false;
            this.signalConn = null;
            this.hasConnType = false;
            this.peerStatus = PeerStatus.Free;
            this.isInitiator = false;
            this.signalingCanceled = false;
        });
    }

    async callPeer() {
      this.callOutgoing = this.peer.call(this.to_device_address, this.mineStream);
      this.callOutgoing.on('stream', async remoteStream => {
        this.peerStatus = PeerStatus.InChat;
        if (this.onRemoteStream) {
            this.onRemoteStream(remoteStream);
        }
      });
      this.callOutgoing.on('close', function() {
        this.callOutgoing = null;
      });
      this.callOutgoing.on('error', function(err) {
        this.callOutgoing = null;
      });
    }

    closeCallConn() {
        if (this.callIncomming) {
          this.callIncomming.close();
        }

        if (this.callOutgoing) {
          this.callOutgoing.close();
        }

        this.onRemoteStream = null;
        if (this.mineStream) {
            this.mineStream.getTracks().forEach(track => track.stop());
        }
        this.mineStream = null;
        this.peerStatus = PeerStatus.Disconnecting;
    }

    closeSignalConn() {
      if (this.hasSignalConn) {
        this.signalConn.close();
      }
      this.resetSignalConn();
    }

    async closeConnection(withSend = true) {
      // WAIT, if close connection was triggert befor signal connections is established
      if (!this.hasSignalConn) {
        let timeoutCnt = 15;
        while (!this.hasSignalConn) {
          await sleep(100);
          timeoutCnt--;
          if (timeoutCnt === 0) {
            break;
          }
        }
      }

      switch (this.peerStatus) {
        case PeerStatus.Dialing:
        case PeerStatus.Free:
          if (this.peerStatus === PeerStatus.Dialing) {
            this.peerStatus = PeerStatus.Disconnecting;
          }
          if (withSend && this.hasSignalConn) {
            this.signalConn.send(StatusCommands.connClose);
          }
          await sleep(1000);
          this.closeSignalConn();
          break;
        case PeerStatus.Receiving:
        case PeerStatus.Connecting:
        case PeerStatus.InChat:
          this.closeCallConn();
          if (withSend && this.hasSignalConn) {
            this.signalConn.send(StatusCommands.connClose);
          }
          await sleep(1000);
          this.closeSignalConn();
          break;
      }
    }

    async addStream() {
        this.mineStream = await this.getMediaStream();
        if (this.mineStream === null) {
            return ConnectResult.ERR_MediaStream;
        }
        this.callIncomming.answer(this.mineStream); // Answer the call with an A/V stream.
        this.callIncomming.on('stream', async remoteStream => {
          this.peerStatus = PeerStatus.InChat;
          if (this.onRemoteStream) {
              this.onRemoteStream(remoteStream);
          }
        });
        this.callIncomming.on('close', function() {
          this.callIncomming = null;
        });
        this.callIncomming.on('error', function(err) {
          this.callIncomming = null;
        });
    }

    resetSignalConn() {
      this.hasSignalConn = false;
      this.signalConn = null;
      this.hasConnType = false;
      this.peerStatus = PeerStatus.Free;
      this.isInitiator = false;
      this.signalingCanceled = false;
      if (this.onConnectionClosed) {
          this.onConnectionClosed();
      }
    }

    async switchStream() {
      return;
      // OLD CODE
/*
      await this.peer.removeStream(this.mineStream);
      this.rearCam = !this.rearCam;
      this.mineStream = await this.getMediaStream();
      if (this.mineStream === null) {
          return ConnectResult.ERR_MediaStream;
      }
      await this.peer.addStream(this.mineStream);
*/
    }

    getIsPeerConnected() {
      if (this.peer !== null && this.peer._open === true ) {
        return true;
      }
      return false;
    }

    getHasCamPermission() {
      return this.hasCamPermission;
    }

    getHasAudioPermission() {
      return this.hasAudioPermission;
    }
}
