import { Component, OnInit, ViewChild, ElementRef, OnDestroy, ViewContainerRef } from '@angular/core';
import { ActivatedRoute, NavigationExtras, Router } from '@angular/router';
import { ActionSheetController, AlertController, Platform, NavController, IonTextarea } from '@ionic/angular';
import { Clipboard } from '@ionic-native/clipboard/ngx';
import { SocialSharing } from '@ionic-native/social-sharing/ngx';
import { Media, MediaObject } from '@ionic-native/media/ngx';
import { MediaCapture, MediaFile, CaptureError, CaptureImageOptions } from '@ionic-native/media-capture/ngx';
import { File } from '@ionic-native/file/ngx';

import constants from 'ocore/constants.js';
import lodash from 'lodash';
import async from 'async';
import path from 'path';
import chatStorage from 'ocore/chat_storage.js';
import privateProfile from 'ocore/private_profile.js';
import objectHash from 'ocore/object_hash.js';
import db from 'ocore/db.js';
import device from 'ocore/device.js';
import eventBus from 'ocore/event_bus.js';
import conf from 'ocore/conf.js';
import storage from 'ocore/storage.js';
import breadcrumbs from 'ocore/breadcrumbs.js';
import ValidationUtils from 'ocore/validation_utils.js';
import { CorrespondentListService, MessageType, Message } from 'src/app/services/ocore/correspondent-list.service';
import { timeout, showConfirm } from 'src/app/library/Util';
import { EventService } from 'src/app/services/ocore/event.service';
import { Keyboard } from '@ionic-native/keyboard/ngx';
import { EmojiService } from 'src/app/services/emoji.service';
import { NotificationService } from 'src/app/services/notification.service';
import { OcoreConfigService } from 'src/app/services/ocore/ocore-config.service';
import moment from 'moment';
import { FileChooserService } from 'src/app/services/webtorrent/file-chooser.service';
import { basename } from 'path';
import { FileTransService } from 'src/app/services/chat/file-trans.service';
import { CallType } from '../media-call/media-call.page';
import { APP_NAME } from 'src/app/library/Config';
import { CallService, PeerStatus } from '../../services/chat/call.service';
import { JSDocCommentStmt } from '@angular/compiler';

enum InstantMediaMode {
  Audio = 0,
  Video
}

enum MediaRecordStatus {
  Free = 0,
  TouchRecord,
  LockRecord
}

@Component({
  selector: 'app-message',
  templateUrl: './message.page.html',
  styleUrls: ['./message.page.scss'],
})
export class MessagePage implements OnInit, OnDestroy {
  private messageInputElement: HTMLTextAreaElement;
  @ViewChild('messageinput', { static: false, read: ViewContainerRef }) set videoContent(content: any) {
    try {
      this.messageInputElement = content._data.renderElement;
    } catch (e) { }
  }

  @ViewChild('messagelog', { static: true })
  messageLogElement: ElementRef<HTMLDivElement>;

  @ViewChild('mediaRecordCamera', { static: true }) mediaRecordCamera: ElementRef<HTMLDivElement>;
  private mediaRecordCamVideo: HTMLVideoElement;

  data = null;
  correspondent;
  messageEvents = [];
  sendingMsgEvents = [];

  autoScrollEnabled = true;
  message = '';
  error;

  isShowEmoji = false;

  isPossibleToLoad = true;
  isLoading = false;

  isMessageSelected = false;
  selectedMessages = [];
  isEditingStatus = false;

  isTouching = false;
  touchTimeoutId = null;

  mediaMode = InstantMediaMode.Audio;  // false: mic, true: camera
  mediaTouchTimerId = null;
  mediaRecordStatus: MediaRecordStatus = MediaRecordStatus.Free;
  mediaRecordedStartTime = 0;    // 100ms
  mediaRecordTimerId = null;

  ownerCamMediaStream: MediaStream = null;

  mediaRecordAudioFileName = null;
  mediaRecordObj: MediaObject = null;

  get deviceAddress() {
    return this.data.device_address;
  }

  get isBeforeMessage() {
    return this.message === '' && this.mediaRecordStatus === MediaRecordStatus.Free;
  }

  get isMediaRecordFree() {
    return this.mediaRecordStatus === MediaRecordStatus.Free;
  }

  get isMediaRecordTouchRecord() {
    return this.mediaRecordStatus === MediaRecordStatus.TouchRecord;
  }

  get isMediaRecordLockRecord() {
    return this.mediaRecordStatus === MediaRecordStatus.LockRecord;
  }

  get isMediaAudioRecording() {
    return this.mediaMode === InstantMediaMode.Audio;
  }

  get mediaRecordedTimeText() {
    if (!this.mediaRecordedStartTime) { return ''; }
    const recordedTime = (Date.now() - this.mediaRecordedStartTime) / 100;
    const min = Math.floor(recordedTime / 600);
    const sec = Math.floor(recordedTime % 600 / 10);
    const msec = Math.floor(recordedTime % 10);
    const secZ = sec < 10 ? '0' : '';
    return `${min}:${secZ}${sec},${msec}`;
  }

  get canCall() {
    if (this.callService.getIsPeerConnected()) {
      return true;
    }
    return false;
  }

  get hasCamPermission() {
    if (this.callService.getHasCamPermission()) {
      return true;
    }
    return false;
  }

  get hasAudioPermission() {
    if (this.callService.hasAudioPermission) {
      return true;
    }
    return false;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private navCtrl: NavController,
    private correspondentListService: CorrespondentListService,
    private alertCtrl: AlertController,
    private keyboard: Keyboard,
    private actionSheetController: ActionSheetController,
    private clipboard: Clipboard,
    private socialSharing: SocialSharing,
    private media: Media,
    private mediaCapture: MediaCapture,
    private file: File,
    private platform: Platform,

    private eventService: EventService,
    private emojiProvider: EmojiService,
    private notificationService: NotificationService,
    private configService: OcoreConfigService,
    private fileChooserService: FileChooserService,
    public fileTransService: FileTransService,
    private callService: CallService,
  ) {
    // alert(JSON.stringify(emojiProvider.getEmojis()))
    this.route.queryParams.subscribe(params => {
      this.data = JSON.parse(params.data);
      if (this.correspondentListService.shareData) {
        this.message = this.correspondentListService.shareData;
        this.correspondentListService.shareData = '';
        setTimeout(() => {
          const textArea = this.messageInputElement.getElementsByTagName('textarea')[0];
          textArea.style.overflow = 'hidden';
          textArea.style.height = 'auto';
          textArea.style.height = textArea.scrollHeight + 'px';
        }, 500);
      }
    });
  }

  ngOnInit() {
    this.notificationService.removeMessage(this.data.device_address);
    this.correspondentListService.setCurrentCorrespondent(this.data.device_address, () => {
      // go.path('correspondentDevices.correspondentDevice');
      this.correspondent = this.correspondentListService.currentCorrespondent;
      if (!this.correspondentListService.messageEventsByCorrespondent[this.correspondent.device_address]) {
        this.correspondentListService.messageEventsByCorrespondent[this.correspondent.device_address] = [];
      }
      this.messageEvents = this.correspondentListService.messageEventsByCorrespondent[this.correspondent.device_address];
      this.loadMoreHistory(() => {
        timeout(() => this.scrollToBottom(), 300);

        for (const i in this.messageEvents) {
          if (this.messageEvents.hasOwnProperty(i)) {
            const messageEvent = this.messageEvents[i];
            if (messageEvent.chat_recording_status) {
              return;
            }
          }
        }
        breadcrumbs.add('correspondent with empty chat opened: ' + this.correspondent.device_address);
        const message = {
          type: 'system',
          bIncoming: false,
          message: JSON.stringify({ state: (this.correspondent.peer_record_pref && this.correspondent.my_record_pref ? true : false) }),
          timestamp: Math.floor(+ new Date() / 1000),
          chat_recording_status: true
        };
        chatStorage.store(this.correspondent.device_address, message.message, 0, 'system');
        this.messageEvents.push(this.correspondentListService.parseMessage(message));
      });

      timeout(() => {
        this.addAnchorEvents();
        const msgElement = document.getElementsByTagName('ion-textarea')[0];
        msgElement.addEventListener('focusin', (event) => {
          const { scrollHeight, scrollTop, clientHeight } = this.messageLogElement.nativeElement;
          // alert(scrollHeight + "   " + scrollTop + "   " + clientHeight);
          if (scrollHeight < scrollTop + clientHeight + 100) {
            timeout(() => this.scrollToBottom(), 300);
          }
        });
      }, 300);
    });

    this.eventService.on('messageIncome', (peer_address) => {
      if (this.data.device_address !== peer_address) { return; }
      this.scrollToBottom();
      this.addAnchorEvents();
    });

    this.messageLogElement.nativeElement.addEventListener('scroll', (event) => {
      this.onTouchEnd();
      const { scrollTop, scrollHeight, clientHeight } = this.messageLogElement.nativeElement;
      if (scrollHeight <= clientHeight || scrollTop !== 0) { return; }

      this.loadMoreHistory(() => {
        timeout(() => {
          const newScrollHeight = this.messageLogElement.nativeElement.scrollHeight;
          this.messageLogElement.nativeElement.scrollTo(0, newScrollHeight - scrollHeight);
        }, 200);
      });
    });

    this.platform.backButton.subscribeWithPriority(10, () => {
      if (this.isShowEmoji) {
        this.isShowEmoji = false;
      } else if (this.keyboard.isVisible) {
        this.keyboard.hide();
      } else {
        this.navCtrl.back();
      }
    });
  }

  ngOnDestroy() {
    this.eventService.remove('messageIncome');
    this.correspondentListService.onBackFromMessage();
    this.correspondentListService.currentCorrespondent = null;
  }

  isSingleEmoji(message) {
    return message.length === 2 && /\p{Emoji}/u.test(message);
  }

  isIncludeEmoji(message) {
    return message.length > 2 && /\p{Emoji}/u.test(message);
  }

  isMyMessage(messageEvent) {
    return !messageEvent.bIncoming && messageEvent.type !== 'system';
  }

  loadMoreHistory(cb) {
    if (this.isLoading || !this.isPossibleToLoad) { return; }

    const curMsgLen = this.messageEvents.length;
    this.isLoading = true;
    this.correspondentListService.loadMoreHistory(this.correspondent, () => {
      if (cb) {
        cb();
      }
      this.isLoading = false;
      const newMsgLen = this.messageEvents.length;
      if (curMsgLen === newMsgLen) { this.isPossibleToLoad = false; }

      const { clientHeight, scrollHeight } = this.messageLogElement.nativeElement;
      if (clientHeight >= scrollHeight) {
        this.loadMoreHistory(cb);
      }
    });
  }

  getMessageClass(messageEvent, isNeedFrom = true) {
    let className = messageEvent.bIncoming ? 'from-them' : (messageEvent.type === 'system' ? 'system' : 'from-me');
    if (!isNeedFrom) {
      className = '';
    }
    if (this.isSingleEmoji(messageEvent.message)) {
      className += ' singleEmoji';
    }
    if (this.isIncludeEmoji(messageEvent.message)) {
      className += ' hasEmoji';
    }

    return className;
  }

  onToggleEmoji() {
    let { isShowEmoji } = this;

    this.messageInputElement.focus();

    timeout(() => {
      isShowEmoji = !isShowEmoji;
      if (isShowEmoji) { this.keyboard.hide(); } else { this.keyboard.show(); }
      this.isShowEmoji = isShowEmoji;
      if (this.isShowEmoji) {
        timeout(() => this.scrollToBottom(), 100);
      }
    }, 0);
  }

  onFocusInput() {
    this.isShowEmoji = false;
  }

  onSend() {
    this.error = null;
    if (!this.message) {
      return;
    }

    const messageId = Date.now();
    const message = lodash.clone(this.message);
    // save in var as $scope.message may disappear while we are sending the message over the network
    let msgObj: Message;
    if (!this.isEditingStatus) {
      msgObj = {
        type: MessageType.Text,
        id: Date.now(),
        message
      };
    } else {
      const selectedId = this.selectedMessages[0].id;
      msgObj = {
        type: MessageType.Modify,
        id: messageId,
        relatedId: selectedId,
        message
      };
      this.onCancelEdit();
    }
    this.message = '';

    this.sendMessage(msgObj);
  }

  async onAddFile() {
    return;
    const filePath = await this.fileChooserService.open();
    if (!filePath) { return; }

    this.sendFile(filePath);
  }

  async sendFile(filePath, messageText = null) {
    /*
    const messageId = Date.now();
    let msgObj: Message;
    if (!messageText) { messageText = basename(filePath); }

    msgObj = {
      type: MessageType.File,
      id: messageId,
      message: messageText,
    };

    this.setOngoingProcess(msgObj, messageId);

    const { fileName, infoHash, magnetURI } = await this.fileTransService.prepareSendFile(filePath);
    msgObj.data = { fileName, infoHash, magnetURI };

    this.sendMessage(msgObj);
    */
  }

  sendMessage(message: Message) {
    const msgJson = JSON.stringify(message);
    const messageId = message.id;
    this.setOngoingProcess(message, messageId);

    device.sendMessageToDevice(this.correspondent.device_address, 'text', msgJson, {
      ifOk: () => {
        this.setOngoingProcess(null, messageId);
        this.autoScrollEnabled = true;

        if (message.type === MessageType.Modify) {
          this.correspondentListService.modifyMessage(message);
          this.correspondentListService.assocLastMessageDateByCorrespondent[this.correspondent.device_address] = {
            date: new Date().toISOString().substr(0, 19).replace('T', ' '),
            message
          };
        } else {
          const msg_obj = {
            ...message,
            bIncoming: false,
            message: this.correspondentListService.formatOutgoingMessage(message),
            timestamp: Math.floor(Date.now() / 1000)
          };
          this.correspondentListService.checkAndInsertDate(this.messageEvents, msg_obj);
          this.messageEvents.push(msg_obj);
          this.correspondentListService.assocLastMessageDateByCorrespondent[this.correspondent.device_address] = {
            date: new Date().toISOString().substr(0, 19).replace('T', ' '),
            message: msg_obj
          };
        }

        if (this.correspondent.my_record_pref && this.correspondent.peer_record_pref) {
          chatStorage.store(this.correspondent.device_address, msgJson, 0);
        }

        timeout(() => this.scrollToBottom(), 100);
        this.addAnchorEvents();
      },
      ifError: (error) => {
        this.setOngoingProcess(null, messageId);
        this.setError(error);
      }
    });
  }

  onPhoneCall() {
    this.callService.peerStatus = PeerStatus.Dialing;
    const extras: NavigationExtras = {
      queryParams: {
        data: JSON.stringify(this.data),
        isVideo: false,
        callType: CallType.Send,
      }
    };
    this.router.navigate(['media-call'], extras);
  }

  onVideoCall() {
    this.callService.peerStatus = PeerStatus.Dialing;
    const extras: NavigationExtras = {
      queryParams: {
        data: JSON.stringify(this.data),
        isVideo: true,
        callType: CallType.Send,
      }
    };
    this.router.navigate(['media-call'], extras);
  }

  setOngoingProcess(message: Message = null, messageId) {
    if (message) {
      if (message.type === MessageType.Modify) { return; }

      const index = this.sendingMsgEvents.findIndex(event => event.id === messageId);
      if (index !== -1) { return; }

      this.sendingMsgEvents.push({
        id: messageId,
        message: this.correspondentListService.formatOutgoingMessage(message.message),
        timestamp: Math.floor(Date.now() / 1000)
      });
      timeout(() => this.scrollToBottom(), 10);
    } else if (this.sendingMsgEvents.length) {
      // alert(JSON.stringify(this.sendingMsgEvents) + "   " + messageId);
      const index = this.sendingMsgEvents.findIndex(event => event.id === messageId);
      // alert(index);
      if (index === -1) { return; }
      this.sendingMsgEvents.splice(index, 1);
    }
  }

  scrollToBottom() {
    const msgList = this.messageLogElement.nativeElement;
    const { scrollHeight } = msgList;
    msgList.scrollTo(0, scrollHeight * 2);
  }

  setError(error) {
    console.log('send error:', error);
    this.error = error;
  }

  async onSelectMessage($event, messageEvent) {
    if (this.isEditingStatus) {
      this.onCancelEdit();
      return;
    }
    const tagName = $event.target.tagName.toLowerCase();
    if (tagName === 'a'
      || tagName === 'ion-button') { return; }
    if (typeof messageEvent.type === 'string') { return; }

    if (this.isMessageSelected) {
      const index = this.getSelectedMsgIndex(messageEvent);
      // alert(index);
      if (index === -1) { this.selectedMessages.push(messageEvent); } else { this.selectedMessages.splice(index, 1); }

      // alert(this.selectedMessages.length);
      if (this.selectedMessages.length === 0) { this.isMessageSelected = false; }
      return;
    }
/*
    if (messageEvent.type === MessageType.File) {
      const { bIncoming } = messageEvent;
      const { infoHash } = messageEvent.data;
      if (bIncoming && !this.fileTransService.isCompletedDownload(infoHash)) {
        if (this.fileTransService.isTorrentExist(messageEvent.data)) {
          const confirmResult = await showConfirm(this.alertCtrl, 'Do you want to cancel this downloading?');
          if (confirmResult) {
            const { device_address } = this.correspondent;
            const { id, data } = messageEvent;
            this.correspondentListService.sendHiddenMessage(device_address, {
              type: MessageType.FileCancel,
              id: Date.now(),
              relatedId: id,
              data,
            });
            this.fileTransService.cancelDownload(data);
          }
        } else if (await showConfirm(this.alertCtrl, 'Do you want to download this file?')) {
          return this.onDownloadFile(messageEvent);
        }
        return;
      }
      this.fileTransService.openFile(messageEvent.data, bIncoming);
      return;
    }
*/
    const buttons: Array<any> = [{
      text: 'Copy',
      icon: 'copy',
      handler: this.onCopyMessage.bind(this, [messageEvent])
    }];

    buttons.push({
      text: 'Share',
      icon: 'share-social',
      handler: this.onShareMessage.bind(this, [messageEvent])
    });

    if (!messageEvent.bIncoming) {
      buttons.push({
        text: 'Remove',
        role: 'destructive',
        icon: 'trash',
        handler: this.onRemoveMessage.bind(this, [messageEvent])
      });
    }

    buttons.push({
      text: 'Cancel',
      icon: 'close',
      role: 'cancel',
      handler: () => {
        console.log('Cancel clicked');
      }
    });

    if (!messageEvent.bIncoming && messageEvent.type === MessageType.Text) {
      buttons.unshift({
        text: 'Edit',
        icon: 'pencil',
        handler: this.onEditMessage.bind(this, messageEvent)
      });
    }
    const actionSheet = await this.actionSheetController.create({
      // header: 'Message',
      buttons
    });

    await actionSheet.present();
  }

  getSelectedMsgIndex(messageEvent) {
    const { id } = messageEvent;
    for (let index = 0; index < this.selectedMessages.length; index++) {
      const message = this.selectedMessages[index];
      if (message.type !== MessageType.Text && message.type !== MessageType.File) { continue; }
      if (message.id === id) { return index; }
    }
    return -1;
  }

  onStartSelectMessage(messageEvent) {
    this.onCancelEdit();
    if (typeof messageEvent.type === 'string') { return; }
    if (this.isMessageSelected) { return; }
    this.isMessageSelected = true;
    this.selectedMessages = [messageEvent];
  }

  onEditMessage(messageEvent) {
    this.selectedMessages = [messageEvent];
    this.onEditMessages();
  }

  onEditMessages() {
    this.isMessageSelected = false;
    this.isEditingStatus = true;
    this.message = this.selectedMessages[0].message;
    this.messageInputElement.focus();
  }

  onCancelEdit() {
    this.selectedMessages = [];
    this.isEditingStatus = false;
    this.message = '';
  }

  onCopyMessage(messageEvent: Array<any>) {
    this.selectedMessages = messageEvent;
    this.onCopyMessages();
  }

  onShareMessage(messageEvent: Array<any>) {
    this.selectedMessages = messageEvent;
    this.onShareMessages();
  }

  onRemoveMessage(messageEvent: Array<any>) {
    this.selectedMessages = messageEvent;
    this.onRemoveMessages();
  }

  onCancelMessageSelect() {
    this.isMessageSelected = false;
    this.selectedMessages = [];
  }

  onCopyMessages() {
    const messageText = this.getMessageText();
    this.clipboard.copy(messageText);
    this.onCancelMessageSelect();
  }

  extractContent(s) {
    const span = document.createElement('span');
    span.innerHTML = s;
    return span.textContent || span.innerText;
  }

  getMessageText() {
    if (this.selectedMessages.length === 1) {
      return this.extractContent(this.selectedMessages[0].message);
    } else {
      this.selectedMessages = this.selectedMessages.sort((a, b) => a.id > b.id ? 1 : -1);
      let result = '';
      this.selectedMessages.forEach(({ bIncoming, id, message }) => {
        let name;
        if (bIncoming) {
          name = this.data.name;
        } else { name = this.configService.configCache.deviceName; }

        const datetime = moment(id).format('M/D/YY, hh:mm A');
        message = this.extractContent(message);
        result += `${name}, [${datetime}]\n${message}\n\n`;
      });

      return result;
    }
  }

  onShareMessages() {
    const messageText = this.getMessageText();
    this.socialSharing.share(messageText, `Messages from ${APP_NAME}`);
    this.onCancelMessageSelect();
  }

  async onRemoveMessages() {
    const actionSheet = await this.actionSheetController.create({
      buttons: [{
        text: 'Remove',
        icon: 'trash',
        handler: () => {
          this.removeMessages();
        }
      }, {
        text: 'Cancel',
        icon: 'close',
        role: 'cancel',
        handler: () => {
          this.onCancelMessageSelect();
        }
      }]
    });

    await actionSheet.present();
  }

  removeMessages() {
    this.selectedMessages.forEach(message => {
      const { id } = message;

      const msgObj = {
        type: MessageType.Remove,
        id: Date.now(),
        relatedId: id,
      };
      const packedMsgStr = JSON.stringify(msgObj);

      device.sendMessageToDevice(this.correspondent.device_address, 'text', packedMsgStr, {
        ifOk: () => {
          this.correspondentListService.removeMessage(msgObj);
          this.correspondentListService.assocLastMessageDateByCorrespondent[this.correspondent.device_address]
            = {
            date: new Date().toISOString().substr(0, 19).replace('T', ' '),
            message: msgObj
          };
          if (this.correspondent.my_record_pref && this.correspondent.peer_record_pref) {
            chatStorage.store(this.correspondent.device_address, packedMsgStr, 0);
          }
        },
        ifError: (error) => {
          this.setError(error);
        }
      });
    });

    this.onCancelMessageSelect();
  }

  convertMessages2Text() {
  }

  onTouchStart(messageEvent) {
    this.isTouching = true;
    this.touchTimeoutId = setTimeout(() => {
      this.onStartSelectMessage(messageEvent);
      this.isTouching = false;
      clearTimeout(this.touchTimeoutId);
      this.touchTimeoutId = null;
    }, 400);
  }

  onTouchEnd() {
    if (!this.isTouching) { return; }
    this.isTouching = false;
    clearTimeout(this.touchTimeoutId);
    this.touchTimeoutId = null;
  }

  addAnchorEvents() {
    const anchors = this.messageLogElement.nativeElement.querySelectorAll('a');
    anchors.forEach(item => {
      if (item.href) {
        item.removeEventListener('click', this.openExternalLink.bind(this, item.href));
        item.addEventListener('click', this.openExternalLink.bind(this, item.href));
      } else {
        if (item.className === 'payment') {
          item.removeEventListener('click', this.openPaymentPage.bind(this, item.text));
          item.addEventListener('click', this.openPaymentPage.bind(this, item.text));
        }
      }
    });
  }

  openExternalLink(link, event: MouseEvent) {
    window.open(link, '_system', 'location=yes');
    event.preventDefault();
    return false;
  }

  openPaymentPage(address, event: MouseEvent) {
    this.navCtrl.navigateRoot('dashboard');
    this.eventService.emit('open_payment_send', address);
    event.preventDefault();
    return false;
  }

  onDownloadFile(messageEvent) {
/*
    if (this.fileTransService.isTorrentExist(messageEvent.data)) { return; }

    const { id, data } = messageEvent;
    const msgObj = {
      type: MessageType.FileRequest,
      id: Date.now(),
      relatedId: id,
      data
    };
    const msgJson = JSON.stringify(msgObj);

    device.sendMessageToDevice(this.correspondent.device_address, 'text', msgJson, {
      ifOk: () => { },
      ifError: (error) => {
        this.setError(error);
      }
    });
*/
  }

  onOpenDirectory(messageEvent) {
/*
    const { bIncoming } = messageEvent;
    const { infoHash } = messageEvent.data;
    this.fileTransService.openDirectory(infoHash, bIncoming);
*/
  }

  async onAddPhoto() {
    return;
    try {
      const result = await this.mediaCapture.captureImage({ limit: 1 });
      if ((result as any).length === undefined) {
        console.log('Image Capture error', result);
      } else {
        console.log('Image Capture result', result);
        const mediaFiles = result as MediaFile[];
        const { fullPath } = mediaFiles[0];
        // const durationText = moment.duration(duration).asSeconds();
        const fileName = `Captured image at ${moment(Date.now()).format('LLL')}`;
        this.sendFile(fullPath, fileName);
      }
    } catch (e) { } finally { }
  }

  onToggleMedia() {
    this.mediaMode = 1 - this.mediaMode;
  }

  onTouchMediaStart() {
    return;
    this.mediaTouchTimerId = setTimeout(() => {
      if (this.mediaMode === InstantMediaMode.Audio) {
        this.mediaRecordStatus = MediaRecordStatus.TouchRecord;
        this.mediaRecordedStartTime = Date.now();
      }
      this.startMediaRecord();
    }, 400);
  }

  onTouchMediaMove($event: TouchEvent) {
    return;
    const { touches } = $event;
    const { clientX, clientY } = touches[0];

    const elements = document.getElementsByClassName('ripple-media-group');
    // console.log(elements.item(0));
    const { offsetLeft, offsetTop } = elements.item(0) as any;

    // console.log(offsetLeft, offsetTop, clientX, clientY);
    if (clientX <= offsetLeft - 20) { this.cancelMediaRecord(); } else if (clientY <= offsetTop) { this.lockMediaRecord(); }
  }

  onTouchMediaEnd() {
    return;
    if (this.isMediaRecordLockRecord) { return; }
    if (!this.isMediaRecordFree) { this.onSendMedia(); } else { this.cancelMediaRecord(); }
  }

  async startMediaRecord() {
    if (this.mediaMode === InstantMediaMode.Audio) {
      const fileName = `${Date.now()}.m4a`;
      const tempDirectory = this.file.externalCacheDirectory;
      this.file.createFile(tempDirectory, fileName, true).then(() => {
        this.mediaRecordObj = this.media.create(tempDirectory.replace(/^file:\/\//, '') + fileName);
        this.mediaRecordObj.startRecord();
        this.mediaRecordAudioFileName = fileName;
      });
    } else {
      try {
        const result = await this.mediaCapture.captureVideo({ limit: 1 });
        if ((result as any).length === undefined) {
          console.log('Video Capture error', result);
        } else {
          console.log('Video Capture result', result);
          const mediaFiles = result as MediaFile[];
          const { fullPath } = mediaFiles[0];
          // const durationText = moment.duration(duration).asSeconds();
          const fileName = `Recorded video at ${moment(Date.now()).format('LLL')}`;
          this.sendFile(fullPath, fileName);
        }
      } catch (e) { } finally {
        this.mediaRecordStatus = MediaRecordStatus.Free;
      }
    }
  }

  cancelMediaRecord() {
    this.stopMediaRecord();
    this.removeMediaRecordedFile();
  }

  async removeMediaRecordedFile() {
    if (this.mediaRecordAudioFileName) {
      const tempDirectory = this.file.externalCacheDirectory;
      await this.file.removeFile(tempDirectory, this.mediaRecordAudioFileName);
      this.mediaRecordAudioFileName = null;
    }
  }

  stopMediaRecord() {
    if (this.mediaMode === InstantMediaMode.Video && !this.isMediaRecordFree) {
      if (this.mediaRecordCamVideo) {
        this.mediaRecordCamVideo.remove();
      }
      this.mediaRecordCamVideo = null;
      if (this.ownerCamMediaStream) {
        this.ownerCamMediaStream.getTracks().forEach(track => track.stop());
        this.ownerCamMediaStream = null;
      }
    }

    this.mediaRecordStatus = MediaRecordStatus.Free;
    if (this.mediaTouchTimerId) {
      clearTimeout(this.mediaTouchTimerId);
    }
    this.mediaTouchTimerId = null;

    if (this.mediaRecordObj) {
      this.mediaRecordObj.stopRecord();
      this.mediaRecordObj = null;
    }
  }

  lockMediaRecord() {
    this.mediaRecordStatus = MediaRecordStatus.LockRecord;
  }

  async onSendMedia() {
    return;
    this.stopMediaRecord();

    if (this.mediaMode === InstantMediaMode.Audio) {
      const filePath = this.file.externalCacheDirectory + this.mediaRecordAudioFileName;
      const duration = Date.now() - this.mediaRecordedStartTime;
      const durationText = moment.duration(duration).asSeconds();
      const fileName = `Recorded audio at ${moment(Date.now()).format('LLL')} [${durationText}s]`;
      await this.sendFile(filePath, fileName);
      this.mediaRecordAudioFileName = null;
    }
  }
}
