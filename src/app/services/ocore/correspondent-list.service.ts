import {Injectable} from '@angular/core';
import async from 'async';
import lodash from 'lodash';
import crypto from 'crypto';
import device from 'ocore/device.js';
import wallet from 'ocore/wallet.js';
import conf from 'ocore/conf.js';
import mutex from 'ocore/mutex.js';
import constants from 'ocore/constants.js';
import eventBus from 'ocore/event_bus.js';
import ValidationUtils from 'ocore/validation_utils.js';
import objectHash from 'ocore/object_hash.js';
import chatStorage from 'ocore/chat_storage.js';
import {timeout} from 'src/app/library/Util';
import {ProfileService} from './profile.service';
import {OcoreConfigService} from './ocore-config.service';
import {EventService} from './event.service';
import {NotificationService} from '../notification.service';

export enum MessageType {
  Text = 0,
  Reply,
  Modify,
  Remove,
  File,

  FileRequest,
  FileReady,
  FileComplete,
  FileCancel
}

export interface Message {
  type: MessageType;
  id: number;
  message?: string;
  relatedId?: number;
  data?: object;
}

@Injectable({
  providedIn: 'root'
})
export class CorrespondentListService {
  // replymessage = "replymessage";
  newMessagesCount = {};
  newMsgCounterEnabled = false;
  currentCorrespondent = null;
  messageEventsByCorrespondent = {};
  assocLastMessageDateByCorrespondent = {};

  payment_request_regexp = /\[.*?\]\((?:byteball|obyte):([0-9A-Z]{32})\?([\w=&;+%]+)\)/g; // payment description within [] is ignored

  historyEndForCorrespondent = {};
  message_signing_key_in_progress;

  shareData = '';

  constructor(
    private profileService: ProfileService,
    private configService: OcoreConfigService,
    private eventService: EventService,
    private notificationService: NotificationService,
  ) {
  }

  init() {
      this.notificationService.init();

      eventBus.on('text', async (from_address, body, message_counter) => {
          let message: Message;
          try {
              message = JSON.parse(body);
          } catch (e) {
              console.log(e);
              return;
          }

          if ((message.type === MessageType.Text || message.type === MessageType.File)
              && (this.currentCorrespondent === null || this.currentCorrespondent.device_address !== from_address)) {
              this.notificationService.addMessage(from_address, message.message);
          }

          device.readCorrespondent(from_address, async (correspondent) => {
              const {id, type, data} = message;
              switch (type) {
                  case MessageType.Text:
                  case MessageType.File:
                      const replyMessage: Message = {
                          type: MessageType.Reply,
                          id: Date.now(),
                          relatedId: message.id
                      };
                      device.sendMessageToDevice(correspondent.device_address, 'text', JSON.stringify(replyMessage));
                      break;

                  case MessageType.Reply:
                      break;

                  case MessageType.Modify:
                      this.modifyMessage(message, correspondent);
                      break;

                  case MessageType.Remove:
                      this.removeMessage(message, correspondent);
                      break;
/*
                  case MessageType.FileRequest:
                      const result = await this.fileTransService.seedFile(data as any, () => {
                          const msgObj = {
                              type: MessageType.FileReady,
                              id: Date.now(),
                              relatedId: id,
                              data,
                              message: result
                          };
                          const {device_address} = correspondent;
                          this.sendHiddenMessage(device_address, msgObj);
                      });
                      return;

                  case MessageType.FileReady:
                      this.fileTransService.receiveFile(data as any, () => {
                          const msgObj = {
                              type: MessageType.FileComplete,
                              id: Date.now(),
                              relatedId: id,
                              data,
                              message: result
                          };
                          const {device_address} = correspondent;
                          this.sendHiddenMessage(device_address, msgObj);
                      });
                      return;

                  case MessageType.FileComplete:
                      this.fileTransService.onCompleteSend(data as any);
                      return;

                  case MessageType.FileCancel:
                      this.fileTransService.cancelDownload(data as any);
                      return;
*/
                  default:
                      return;
              }

              if (!this.messageEventsByCorrespondent[correspondent.device_address]) {
                  this.loadMoreHistory(correspondent);
              }
              if (message.type === MessageType.Text
                  || message.type === MessageType.File
                  || message.type === MessageType.Reply) {
                  this.addIncomingMessageEvent(correspondent.device_address, message, message_counter);
              }
              if (correspondent.my_record_pref && correspondent.peer_record_pref) {
                  chatStorage.store(from_address, body, 1);
              }
          });
      });

      eventBus.on('chat_recording_pref', (correspondent_address, enabled, message_counter) => {
          device.readCorrespondent(correspondent_address, (correspondent) => {
              const oldState = (correspondent.peer_record_pref && correspondent.my_record_pref);
              correspondent.peer_record_pref = enabled;
              const newState = (correspondent.peer_record_pref && correspondent.my_record_pref);
              device.updateCorrespondentProps(correspondent);
              if (newState !== oldState) {
                  if (!this.messageEventsByCorrespondent[correspondent_address]) {
                      this.messageEventsByCorrespondent[correspondent_address] = [];
                  }
                  const message = {
                      type: 'system',
                      message: JSON.stringify({state: newState}),
                      timestamp: Math.floor(Date.now() / 1000),
                      chat_recording_status: true,
                      message_counter
                  };
                  timeout(() => {
                      // $rootScope.$digest();
                  });
                  chatStorage.store(correspondent_address, JSON.stringify({state: newState}), 0, 'system');
              }
              if (this.currentCorrespondent && this.currentCorrespondent.device_address === correspondent_address) {
                  this.currentCorrespondent.peer_record_pref = enabled ? 1 : 0;
              }
          });
      });

      eventBus.on('paired', (device_address) => {
          if (!this.currentCorrespondent) {
              return;
          }
          if (device_address !== this.currentCorrespondent.device_address) {
              return;
          }
          // re-read the correspondent to possibly update its name
          device.readCorrespondent(device_address, (correspondent) => {
              // do not assign a new object, just update its property (this object was already bound to a model)
              this.currentCorrespondent.name = correspondent.name;
              timeout(() => {
                  // $rootScope.$digest();
              });
          });
      });

      eventBus.on('removed_paired_device', (device_address) => {
          this.messageEventsByCorrespondent[device_address] = [];
          if (!this.currentCorrespondent) {
              return;
          }
          if (device_address !== this.currentCorrespondent.device_address) {
              return;
          }
      });

      this.eventService.on('Local/CorrespondentInvitation', (event, device_pubkey, device_hub, pairing_secret) => {
          console.log('CorrespondentInvitation', device_pubkey, device_hub, pairing_secret);
          this.acceptInvitation(device_hub, device_pubkey, pairing_secret, () => {
          });
      });

      // function to get last messages
      this.loadLastMessages();
      this.listenForProsaicContractResponse();
  }

  onBackFromMessage() {
      const {device_address} = this.currentCorrespondent;
      if (!device_address) {
          return;
      }

      this.messageEventsByCorrespondent[device_address] = [];
      this.historyEndForCorrespondent[device_address] = false;
  }

  sendHiddenMessage(device_address: string, msgObj: Message | object) {
      const msgJson = JSON.stringify(msgObj);

      device.sendMessageToDevice(device_address, 'text', msgJson, {
          ifOk: () => {
          },
          ifError: (error) => {
          }
      });
  }

  addIncomingMessageEvent(from_address, message: Message, message_counter) {
      const walletGeneral = require('ocore/wallet_general.js');
      walletGeneral.readMyAddresses((arrMyAddresses) => {
          let body = null;
          if (message.type === MessageType.Text || message.type === MessageType.File) {
              body = this.highlightActions(this.escapeHtml(message.message), arrMyAddresses);
              body = this.text2html(body);
              console.log('body with markup: ' + body);
              message.message = body;
          }
          this.addMessageEvent(true, from_address, message, message_counter);
      });
  }

  addMessageEvent(bIncoming, peer_address, message: Message, message_counter = 0, skip_history_load = false) {
      if (!this.messageEventsByCorrespondent[peer_address] && !skip_history_load) {
          return this.loadMoreHistory({device_address: peer_address}, () => {
              this.addMessageEvent(bIncoming, peer_address, message, message_counter, true);
          });
      }
      if (bIncoming) {
          if (peer_address in this.newMessagesCount) {
              this.newMessagesCount[peer_address]++;
          } else {
              this.newMessagesCount[peer_address] = 1;
          }
          if (this.newMessagesCount[peer_address] === 1 &&
              (!this.currentCorrespondent || this.currentCorrespondent.device_address !== peer_address)) {
              this.messageEventsByCorrespondent[peer_address].push({
                  bIncoming: false,
                  message: '<span>new messages</span>',
                  type: 'system',
                  new_message_delim: true
              });
          }
      }
      const msg_obj = {
          bIncoming,
          ...message,
          timestamp: Math.floor(Date.now() / 1000),
          message_counter
      };
      if (message.type === MessageType.Reply) {
          if (msg_obj.bIncoming) {
              const messageEvents: Array<any> = this.messageEventsByCorrespondent[peer_address];
              for (let i = messageEvents.length - 1; i >= 0; i--) {
                  if (messageEvents[i].isChecked) {
                      return;
                  }
                  messageEvents[i].isChecked = true;
              }
          }
          return;
      }
      this.checkAndInsertDate(this.messageEventsByCorrespondent[peer_address], msg_obj);
      this.insertMsg(this.messageEventsByCorrespondent[peer_address], msg_obj);
      this.assocLastMessageDateByCorrespondent[peer_address] = {
        date: new Date().toISOString().substr(0, 19).replace('T', ' '),
        message: msg_obj
      };

      timeout(() => {
          this.eventService.emit('messageIncome', peer_address);
      }, 100);
  }

  insertMsg(messages, msg_obj) {
      for (let i = messages.length - 1; i >= 0 && msg_obj.message_counter; i--) {
          const message = messages[i];
          if (message.message_counter === undefined || message.message_counter && msg_obj.message_counter > message.message_counter) {
              messages.splice(i + 1, 0, msg_obj);
              return;
          }
      }
      messages.push(msg_obj);
  }

  highlightActions(text, arrMyAddresses) {
      const assocReplacements = {};
      let index = crypto.randomBytes(4).readUInt32BE(0);
      const toDelayedReplacement = (new_text) => {
          index++;
          const key = '{' + index + '}';
          assocReplacements[key] = new_text;
          return key;
      };
      const _text = text.replace(/(.*?\s|^)([2-7A-Z]{32})([\s.,;!:].*?|$)/g, (str, pre, address, post) => {
          if (!ValidationUtils.isValidAddress(address)) {
              return str;
          }
          if (pre.lastIndexOf(')') < pre.lastIndexOf('](')) {
              return str;
          }
          if (post.indexOf('](') < post.indexOf('[') || (post.indexOf('](') > -1) && (post.indexOf('[') === -1)) {
              return str;
          }
          index++;
          const key = '{' + index + '}';
          assocReplacements[key] = `<a class="payment">${address}</a>`;
          return pre + key + post;
      }).replace(/(.*?\s|^)\b(https?:\/\/\S+)([\s.,;!:].*?|$)/g, (str, pre, link, post) => {
          if (pre.lastIndexOf(')') < pre.lastIndexOf('](')) {
              return str;
          }
          if (post.indexOf('](') < post.indexOf('[') || (post.indexOf('](') > -1) && (post.indexOf('[') === -1)) {
              return str;
          }
          index++;
          const key = '{' + index + '}';
          assocReplacements[key] = '<a href="' + this.escapeQuotes(link) + '" class="external-link">' + link + '</a>';
          return pre + key + post;
      }).replace(this.payment_request_regexp, (str, address, query_string) => {
          if (!ValidationUtils.isValidAddress(address)) {
              return str;
          }
          const objPaymentRequest = this.parsePaymentRequestQueryString(query_string);
          if (!objPaymentRequest) {
              return str;
          }
          return toDelayedReplacement('<a ng-click="sendPayment(\'' + address + '\', '
              + objPaymentRequest.amount + ', \'' + objPaymentRequest.asset + '\', \''
              + objPaymentRequest.device_address + '\', \'' + objPaymentRequest.single_address + '\')">'
              + objPaymentRequest.amountStr + '</a>');
      }).replace(/\[(.+?)\]\(suggest-command:(.+?)\)/g, (str, description, command) => {
          return toDelayedReplacement('<a ng-click="suggestCommand(\''
              + this.escapeQuotes(command) + '\')" class="suggest-command">' + description + '</a>');
      }).replace(/\[(.+?)\]\(command:(.+?)\)/g, (str, description, command) => {
          return toDelayedReplacement('<a ng-click="sendCommand(\'' + this.escapeQuotes(command)
              + '\', \'' + this.escapeQuotes(description) + '\')" class="command">' + description + '</a>');
      }).replace(/\[(.+?)\]\(payment:(.+?)\)/g, (str, description, paymentJsonBase64) => {
          const arrMovements = this.getMovementsFromJsonBase64PaymentRequest(paymentJsonBase64, true);
          if (!arrMovements) {
              return '[invalid payment request]';
          }
          description = 'Payment request: ' + arrMovements.join(', ');
          return toDelayedReplacement('<a ng-click="sendMultiPayment(\'' + paymentJsonBase64 + '\')">' + description + '</a>');
      }).replace(/\[(.+?)\]\(vote:(.+?)\)/g, (str, description, voteJsonBase64) => {
          const objVote = this.getVoteFromJsonBase64(voteJsonBase64);
          if (!objVote) {
              return '[invalid vote request]';
          }
          return toDelayedReplacement('<a ng-click="sendVote(\'' + voteJsonBase64 + '\')">' + objVote.choice + '</a>');
      }).replace(/\[(.+?)\]\(profile:(.+?)\)/g, (str, description, privateProfileJsonBase64) => {
          const objPrivateProfile = this.getPrivateProfileFromJsonBase64(privateProfileJsonBase64);
          if (!objPrivateProfile) {
              return '[invalid profile]';
          }
          return toDelayedReplacement('<a ng-click="acceptPrivateProfile(\'' + privateProfileJsonBase64 + '\')">[Profile of '
              + objPrivateProfile._label + ']</a>');
      }).replace(/\[(.+?)\]\(profile-request:([\w,]+?)\)/g, (str, description, fields_list) => {
          return toDelayedReplacement('<a ng-click="choosePrivateProfile(\'' + this.escapeQuotes(fields_list) +
              '\')">[Request for profile]</a>');
      }).replace(/\[(.+?)\]\(sign-message-request:(.+?)\)/g, (str, description, message_to_sign) => {
          return toDelayedReplacement('<a ng-click="showSignMessageModal(\'' + this.escapeQuotes(message_to_sign) +
              '\')">[Request to sign message: ' + message_to_sign + ']</a>');
      }).replace(/\[(.+?)\]\(signed-message:(.+?)\)/g, (str, description, signedMessageBase64) => {
          const info = this.getSignedMessageInfoFromJsonBase64(signedMessageBase64);
          if (!info) {
              return '<i>[invalid signed message]</i>';
          }
          const objSignedMessage = info.objSignedMessage;
          let __text = 'Message signed by ' + objSignedMessage.authors[0].address + ': ' + objSignedMessage.signed_message;
          if (info.bValid) {
              __text += ' (valid)';
          } else if (info.bValid === false) {
              __text += ' (invalid)';
          } else {
              __text += ' (<a ng-click="verifySignedMessage(\'' + signedMessageBase64 + '\')">verify</a>)';
          }
          return toDelayedReplacement('<i>[' + __text + ']</i>');
      }).replace(/\(prosaic-contract:(.+?)\)/g, (str, contractJsonBase64) => {
          const objContract = this.getProsaicContractFromJsonBase64(contractJsonBase64);
          if (!objContract) {
              return '[invalid contract]';
          }
          return toDelayedReplacement('<a ng-click="showProsaicContractOffer(\'' + contractJsonBase64 +
              '\', true)" class="prosaic_contract_offer">[Prosaic contract ' + (objContract.status ? objContract.status : 'offer')
              + ': ' + objContract.title + ']</a>');
      });
      for (const key in assocReplacements) {
          if (assocReplacements.hasOwnProperty(key)) {
              text = _text.replace(key, assocReplacements[key]);
          }
      }
      return text;
  }

  getMovementsFromJsonBase64PaymentRequest(paymentJsonBase64, bAggregatedByAsset = false) {
      const paymentJson = new Buffer(paymentJsonBase64, 'base64').toString('utf8');
      console.log(paymentJson);
      let objMultiPaymentRequest;
      try {
          objMultiPaymentRequest = JSON.parse(paymentJson);
      } catch (e) {
          return null;
      }
      if (!ValidationUtils.isNonemptyArray(objMultiPaymentRequest.payments)) {
        return null;
      }
      if (!objMultiPaymentRequest.payments.every((objPayment) => {
        return (ValidationUtils.isValidAddress(objPayment.address)
          && ValidationUtils.isPositiveInteger(objPayment.amount)
          && (!objPayment.asset || objPayment.asset === 'base' || ValidationUtils.isValidBase64(objPayment.asset, constants.HASH_LENGTH)));
      })) {
          return null;
      }
      if (objMultiPaymentRequest.definitions) {
          for (const destinationAddress in objMultiPaymentRequest.definitions) {
              if (objMultiPaymentRequest.definitions.hasOwnProperty(destinationAddress)) {
                  const arrDefinition = objMultiPaymentRequest.definitions[destinationAddress].definition;
                  if (destinationAddress !== objectHash.getChash160(arrDefinition)) {
                      return null;
                  }
              }
          }
      }
      let assocPaymentsByAsset;
      try {
          assocPaymentsByAsset = this.getPaymentsByAsset(objMultiPaymentRequest);
      } catch (e) {
          return null;
      }
      let arrMovements = [];
      if (bAggregatedByAsset) {
          for (const asset in assocPaymentsByAsset) {
              if (assocPaymentsByAsset.hasOwnProperty(asset)) {
                  arrMovements.push(this.getAmountText(assocPaymentsByAsset[asset], asset));
              }
          }
      } else {
          arrMovements = objMultiPaymentRequest.payments.map((objPayment) => {
              return this.getAmountText(objPayment.amount, objPayment.asset || 'base') + ' to ' + objPayment.address;
          });
      }
      return arrMovements;
  }

  getVoteFromJsonBase64(voteJsonBase64) {
      const voteJson = new Buffer(voteJsonBase64, 'base64').toString('utf8');
      console.log(voteJson);
      let objVote;
      try {
          objVote = JSON.parse(voteJson);
      } catch (e) {
          return null;
      }
      if (!ValidationUtils.isStringOfLength(objVote.poll_unit, 44) || typeof objVote.choice !== 'string') {
          return null;
      }
      return objVote;
  }

  getPrivateProfileFromJsonBase64(privateProfileJsonBase64) {
      const privateProfile = require('ocore/private_profile.js');
      const objPrivateProfile = privateProfile.getPrivateProfileFromJsonBase64(privateProfileJsonBase64);
      if (!objPrivateProfile) {
          return null;
      }
      const arrFirstFields = [];
      for (const field in objPrivateProfile.src_profile) {
          if (objPrivateProfile.src_profile.hasOwnProperty(field)) {
              const value = objPrivateProfile.src_profile[field];
              if (!Array.isArray(value)) {
                  continue;
              }
              arrFirstFields.push(value[0]);
              if (arrFirstFields.length === 2) {
                  break;
              }
          }
      }
      objPrivateProfile._label = arrFirstFields.join(' ');
      return objPrivateProfile;
  }

  getProsaicContractFromJsonBase64(strJsonBase64) {
      const strJSON = Buffer.from(strJsonBase64, 'base64').toString('utf8');
      let objProsaicContract;
      try {
          objProsaicContract = JSON.parse(strJSON);
      } catch (e) {
          return null;
      }
      if (!ValidationUtils.isValidAddress(objProsaicContract.my_address) || !objProsaicContract.text.length) {
          return null;
      }
      return objProsaicContract;
  }

  getSignedMessageInfoFromJsonBase64(signedMessageBase64) {
      const signedMessageJson = Buffer.from(signedMessageBase64, 'base64').toString('utf8');
      console.log(signedMessageJson);
      let objSignedMessage;
      try {
          objSignedMessage = JSON.parse(signedMessageJson);
      } catch (e) {
          return null;
      }
      const info = {
          objSignedMessage,
          bValid: undefined
      };
      const validation = require('ocore/validation.js');
      validation.validateSignedMessage(objSignedMessage, (err) => {
          info.bValid = !err;
          if (err) {
              console.log('validateSignedMessage: ' + err);
          }
      });
      return info;
  }

  getPaymentsByAsset(objMultiPaymentRequest) {
      const assocPaymentsByAsset = {};
      objMultiPaymentRequest.payments.forEach((objPayment) => {
          const asset = objPayment.asset || 'base';
          if (asset !== 'base' && !ValidationUtils.isValidBase64(asset, constants.HASH_LENGTH)) {
              throw Error('asset ' + asset + ' is not valid');
          }
          if (!ValidationUtils.isPositiveInteger(objPayment.amount)) {
              throw Error('amount ' + objPayment.amount + ' is not valid');
          }
          if (!assocPaymentsByAsset[asset]) {
              assocPaymentsByAsset[asset] = 0;
          }
          assocPaymentsByAsset[asset] += objPayment.amount;
      });
      return assocPaymentsByAsset;
  }

  formatOutgoingMessage(msgObj) {
      let message = msgObj;
      if (typeof message === 'object') {
          message = msgObj.message;
      }
      const assocReplacements = {};
      let index = crypto.randomBytes(4).readUInt32BE(0);
      const toDelayedReplacement = (new_text) => {
          index++;
          const key = '{' + index + '}';
          assocReplacements[key] = new_text;
          return key;
      };
      let _text = this.escapeHtmlAndInsertBr(message).replace(this.payment_request_regexp, (str, address, query_string) => {
          if (!ValidationUtils.isValidAddress(address)) {
              return str;
          }
          const objPaymentRequest = this.parsePaymentRequestQueryString(query_string);
          if (!objPaymentRequest) {
              return str;
          }
          return toDelayedReplacement('<i>' + objPaymentRequest.amountStr + ' to ' + address + '</i>');
      }).replace(/\[(.+?)\]\(payment:(.+?)\)/g, (str, description, paymentJsonBase64) => {
          const arrMovements = this.getMovementsFromJsonBase64PaymentRequest(paymentJsonBase64);
          if (!arrMovements) {
              return '[invalid payment request]';
          }
          return toDelayedReplacement('<i>Payment request: ' + arrMovements.join(', ') + '</i>');
      }).replace(/\[(.+?)\]\(vote:(.+?)\)/g, (str, description, voteJsonBase64) => {
          const objVote = this.getVoteFromJsonBase64(voteJsonBase64);
          if (!objVote) {
              return '[invalid vote request]';
          }
          return toDelayedReplacement('<i>Vote request: ' + objVote.choice + '</i>');
      }).replace(/\[(.+?)\]\(profile:(.+?)\)/g, (str, description, privateProfileJsonBase64) => {
          const objPrivateProfile = this.getPrivateProfileFromJsonBase64(privateProfileJsonBase64);
          if (!objPrivateProfile) {
              return '[invalid profile]';
          }
          return toDelayedReplacement('<a ng-click="acceptPrivateProfile(\'' + privateProfileJsonBase64 + '\')">[Profile of '
              + objPrivateProfile._label + ']</a>');
      }).replace(/\[(.+?)\]\(profile-request:([\w,]+?)\)/g, (str, description, fields_list) => {
          return toDelayedReplacement('[Request for profile fields ' + fields_list + ']');
      }).replace(/\[(.+?)\]\(sign-message-request:(.+?)\)/g, (str, description, message_to_sign) => {
          return toDelayedReplacement('<i>[Request to sign message: ' + message_to_sign + ']</i>');
      }).replace(/\[(.+?)\]\(signed-message:(.+?)\)/g, (str, description, signedMessageBase64) => {
          const info = this.getSignedMessageInfoFromJsonBase64(signedMessageBase64);
          if (!info) {
              return '<i>[invalid signed message]</i>';
          }
          const objSignedMessage = info.objSignedMessage;
          let text = 'Message signed by ' + objSignedMessage.authors[0].address + ': ' + objSignedMessage.signed_message;
          if (info.bValid) {
              text += ' (valid)';
          } else if (info.bValid === false) {
              text += ' (invalid)';
          } else {
              text += ' (<a ng-click="verifySignedMessage(\'' + signedMessageBase64 + '\')">verify</a>)';
          }
          return toDelayedReplacement('<i>[' + text + ']</i>');
      }).replace(/\bhttps?:\/\/\S+/g, (str) => {
          return toDelayedReplacement('<a href="' + this.escapeQuotes(str) + '" class="external-link">' + str + '</a>');
      }).replace(/\(prosaic-contract:(.+?)\)/g, (str, contractJsonBase64) => {
          const objContract = this.getProsaicContractFromJsonBase64(contractJsonBase64);
          if (!objContract) {
              return '[invalid contract]';
          }
          return toDelayedReplacement('<a ng-click="showProsaicContractOffer(\'' + contractJsonBase64 +
              '\', false)" class="prosaic_contract_offer">[Prosaic contract ' + (objContract.status ? objContract.status : 'offer') +
              ': ' + objContract.title + ']</a>');
      });
      for (const key in assocReplacements) {
          if (assocReplacements.hasOwnProperty(key)) {
              _text = _text.replace(key, assocReplacements[key]);
          }
      }
      return _text;
  }

  parsePaymentRequestQueryString(query_string) {
      const URI = require('ocore/uri.js');
      const assocParams = URI.parseQueryString(query_string, '&amp;');
      const strAmount = assocParams.amount;
      if (!strAmount) {
          return null;
      }
      const amount = parseInt(strAmount);
      if (amount + '' !== strAmount) {
          return null;
      }
      if (!ValidationUtils.isPositiveInteger(amount)) {
          return null;
      }
      const asset = assocParams.asset || 'base';
      console.log('asset=' + asset);
      if (asset !== 'base' && !ValidationUtils.isValidBase64(asset, constants.HASH_LENGTH)) { // invalid asset
          return null;
      }
      const device_address = assocParams.device_address || '';
      if (device_address && !ValidationUtils.isValidDeviceAddress(device_address)) {
          return null;
      }
      let single_address = assocParams.single_address || 0;
      if (single_address) {
          single_address = single_address.replace(/^single/, '');
      }
      if (single_address && !ValidationUtils.isValidAddress(single_address)) {
          single_address = 1;
      }
      const amountStr = 'Payment request: ' + this.getAmountText(amount, asset);
      return {
          amount,
          asset,
          device_address,
          amountStr,
          single_address
      };
  }

  text2html(text) {
      return text.replace(/\r/g, '').replace(/\n/g, '<br>').replace(/\t/g, ' &nbsp; &nbsp; ');
  }

  escapeHtml(text) {
      return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  escapeHtmlAndInsertBr(text) {
      return this.text2html(this.escapeHtml(text));
  }

  escapeQuotes(text) {
      return text.replace(/(['\\])/g, '\\$1').replace(/"/g, '&quot;');
  }

  setCurrentCorrespondent(correspondent_device_address, onDone) {
      if (!this.currentCorrespondent || correspondent_device_address !== this.currentCorrespondent.device_address) {
          device.readCorrespondent(correspondent_device_address, (correspondent) => {
              this.currentCorrespondent = correspondent;
              onDone(true);
          });
      } else {
          onDone(false);
      }
  }

  // amount is in smallest units
  getAmountText(amount, asset) {
      if (asset === 'base') {
          const walletSettings = this.configService.getSync().wallet.settings;
          const unitValue = walletSettings.unitValue;
          const unitName = walletSettings.unitName;
          if (amount !== 'all') {
              amount /= unitValue;
          }
          return amount + ' ' + unitName;
      } else if (asset === constants.BLACKBYTES_ASSET) {
          const walletSettings = this.configService.getSync().wallet.settings;
          const bbUnitValue = walletSettings.bbUnitValue;
          const bbUnitName = walletSettings.bbUnitName;
          amount /= bbUnitValue;
          return amount + ' ' + bbUnitName;
      } else if (this.profileService.assetMetadata[asset]) {
          amount /= Math.pow(10, this.profileService.assetMetadata[asset].decimals || 0);
          return amount + ' ' + this.profileService.assetMetadata[asset].name;
      } else {
          wallet.readAssetMetadata([asset], () => {
          });
          return amount + ' of ' + asset;
      }
  }

  getHumanReadableDefinition(arrDefinition, arrMyAddresses, arrMyPubKeys, assocPeerNamesByAddress, bWithLinks) {
      let parse: (arr) => string;
      let parseAndIndent: (arr) => string;
      const getDisplayAddress = (address) => {
          if (arrMyAddresses.indexOf(address) >= 0) {
              return '<span title="your address: ' + address + '">you</span>';
          }
          if (assocPeerNamesByAddress[address]) {
              return '<span title="peer address: ' + address + '">' + this.escapeHtml(assocPeerNamesByAddress[address]) + '</span>';
          }
          return address;
      };
      parse = (arrSubdefinition) => {
          const op = arrSubdefinition[0];
          const args = arrSubdefinition[1];

          switch (op) {
              case 'sig':
                  const pubkey = args.pubkey;
                  return 'signed by ' + (arrMyPubKeys.indexOf(pubkey) >= 0 ? 'you' : 'public key ' + pubkey);
              case 'address':
                  return 'signed by ' + getDisplayAddress(args);
              case 'cosigned by':
                  return 'co-signed by ' + getDisplayAddress(args);
              case 'not':
                  return '<span class="size-18">not</span>' + parseAndIndent(args);
              case 'or':
              case 'and':
                  return args.map(parseAndIndent).join('<span class="size-18">' + op + '</span>');
              case 'r of set':
                  return 'at least ' + args.required + ' of the following is true:<br>' + args.set.map(parseAndIndent).join(',');
              case 'weighted and':
                  return 'the total weight of the true conditions below is at least ' + args.required + ':<br>' + args.set.map((arg) => {
                      return arg.weight + ': ' + parseAndIndent(arg.value);
                  }).join(',');
              case 'in data feed':
                  const arrAddresses = args[0];
                  const feed_name = args[1];
                  const relation = args[2];
                  const value = args[3];
                  const min_mci = args[4];
                  if (feed_name === 'timestamp' && relation === '>' &&
                      (typeof value === 'number' || parseInt(value).toString() === value)) {
                      return 'after ' + ((typeof value === 'number') ? new Date(value).toString() : new Date(parseInt(value)).toString());
                  }
                  let str = 'Oracle ' + arrAddresses.join(', ') + ' posted ' + feed_name + ' ' + relation + ' ' + value;
                  if (min_mci) {
                      str += ' after MCI ' + min_mci;
                  }
                  return str;
              case 'in merkle':
                  const _arrAddresses = args[0];
                  const _feed_name = args[1];
                  const _value = args[2];
                  const _min_mci = args[3];
                  let _str = 'A proof is provided that oracle ' + _arrAddresses.join(', ') + ' posted ' + _value + ' in ' + _feed_name;
                  if (_min_mci) {
                      _str += ' after MCI ' + _min_mci;
                  }
                  return _str;
              case 'has':
                  if (args.what === 'output' && args.asset && args.amount_at_least && args.address) {
                      return 'sends at least ' + this.getAmountText(args.amount_at_least, args.asset) +
                          ' to ' + getDisplayAddress(args.address);
                  }
                  if (args.what === 'output' && args.asset && args.amount && args.address) {
                      return 'sends ' + this.getAmountText(args.amount, args.asset) + ' to ' + getDisplayAddress(args.address);
                  }
                  return JSON.stringify(arrSubdefinition);
              case 'seen':
                  if (args.what === 'output' && args.asset && args.amount && args.address) {
                      const dest_address = ((args.address === 'this address') ? objectHash.getChash160(arrDefinition) : args.address);
                      const bOwnAddress = (arrMyAddresses.indexOf(args.address) >= 0);
                      const expected_payment = this.getAmountText(args.amount, args.asset) + ' to ' + getDisplayAddress(args.address);
                      return 'there was a transaction that sends ' + ((bWithLinks && !bOwnAddress) ?
                          ('<a ng-click="sendPayment(\'' + dest_address + '\', ' + args.amount + ', \'' + args.asset + '\')">'
                              + expected_payment + '</a>') : expected_payment);
                  } else if (args.what === 'input' && (args.asset && args.amount || !args.asset && !args.amount) && args.address) {
                      const how_much = (args.asset && args.amount) ? this.getAmountText(args.amount, args.asset) : '';
                      return 'there was a transaction that spends ' + how_much + ' from ' + args.address;
                  }
                  return JSON.stringify(arrSubdefinition);

              default:
                  return JSON.stringify(arrSubdefinition);
          }
      };
      parseAndIndent = (arrSubdefinition) => {
          return '<div class="indent">' + parse(arrSubdefinition) + '</div>\n';
      };
      return parse(arrDefinition);  // , 0);
  }

  loadMoreHistory(correspondent, cb = null) {
      if (this.historyEndForCorrespondent[correspondent.device_address]) {
          if (cb) {
              cb();
          }
          return;
      }
      if (!this.messageEventsByCorrespondent[correspondent.device_address]) {
          this.messageEventsByCorrespondent[correspondent.device_address] = [];
      }
      const messageEvents: Array<any> = this.messageEventsByCorrespondent[correspondent.device_address];
      console.log('messageEvents: ', messageEvents);
      const limit = 40;
      let last_msg_ts = null;
      let last_msg_id = 90071992547411;
      if (messageEvents.length && messageEvents[0].id) {
          console.log('messageEvents[0].timestamp', messageEvents[0].timestamp);
          last_msg_ts = new Date(messageEvents[0].timestamp * 1000);
          last_msg_id = messageEvents[0].r_id;
      }
      chatStorage.load(correspondent.device_address, last_msg_id, limit, (messages) => {
          for (const i in messages) {
              if (messages.hasOwnProperty(i)) {
                  messages[i] = this.parseMessage(messages[i]);
              }
          }
          const walletGeneral = require('ocore/wallet_general.js');
          walletGeneral.readMyAddresses((arrMyAddresses) => {
              let checkedIndex = -1;
              if (messages.length < limit) {
                  this.historyEndForCorrespondent[correspondent.device_address] = true;
              }

              const remainedMessages = [];
              for (const i in messages) {
                  if (messages.hasOwnProperty(i)) {
                      const message = messages[i];
                      // var msg_ts = new Date(message.id);  //new Date(message.creation_date.replace(' ', 'T') + '.000Z');
                      const msg_ts = new Date(message.creation_date.replace(' ', 'T') + '.000Z');
                      if (message.type === MessageType.Reply) { // Process reply message
                          if (checkedIndex === -1 && message.is_incoming) {
                              checkedIndex = messageEvents.length;
                          }
                          continue;
                      }
                      if (checkedIndex === -1 && message.is_incoming) {
                          checkedIndex = messageEvents.length;
                      }

                      if (last_msg_ts && last_msg_ts.getDay() !== msg_ts.getDay()) {
                          messageEvents.unshift({
                              type: 'system', bIncoming: false, message: '<span>' + last_msg_ts.toDateString() +
                                  '</span>', timestamp: Math.floor(msg_ts.getTime() / 1000)
                          });
                      }
                      last_msg_ts = msg_ts;
                      if (message.type === MessageType.Text || message.type === MessageType.File) {
                          if (message.is_incoming) {
                              message.message = this.highlightActions(this.escapeHtml(message.message), arrMyAddresses);
                              message.message = this.text2html(message.message);
                          } else {
                              message.message = this.formatOutgoingMessage(message);
                          }
                      } else if (message.type === MessageType.Modify || message.type === MessageType.Remove) {
                          remainedMessages.push(message);
                          continue;
                      }

                      if (message.type === 'system') {
                          continue;
                      }

                      messageEvents.unshift({
                          r_id: message.r_id,
                          id: message.id,
                          type: message.type,
                          bIncoming: message.is_incoming,
                          message: message.message,
                          data: message.data,
                          timestamp: Math.floor(message.id / 1000),
                          chat_recording_status: message.chat_recording_status
                      });
                  }
              }

              for (let j = remainedMessages.length - 1; j >= 0; j--) {
                  const message = remainedMessages[j];
                  if (message.type === MessageType.Modify) {
                      this.modifyMessage(message, correspondent);
                  } else if (message.type === MessageType.Remove) {
                      this.removeMessage(message, correspondent);
                  }
              }
              if (this.historyEndForCorrespondent[correspondent.device_address] && messageEvents.length > 1) {
                  messageEvents.unshift({
                      type: 'system',
                      bIncoming: false,
                      message: '<span>' + (last_msg_ts ? last_msg_ts : new Date()).toDateString() + '</span>',
                      timestamp: Math.floor((last_msg_ts ? last_msg_ts : new Date()).getTime() / 1000)
                  });
              }

              if (checkedIndex !== -1) {
                  const len = messageEvents.length;
                  for (let index = checkedIndex; index < messageEvents.length; index++) {
                      messageEvents[len - index - 1].isChecked = true;
                  }
              }
              if (cb) {
                  cb();
              }
          });
      });
  }

  checkAndInsertDate(messageEvents, message) {
      if (messageEvents.length === 0 || typeof messageEvents[messageEvents.length - 1].timestamp === 'undefined') {
          return;
      }

      const msg_ts = new Date(message.timestamp * 1000);
      const last_msg_ts = new Date(messageEvents[messageEvents.length - 1].timestamp * 1000);
      if (last_msg_ts.getDay() !== msg_ts.getDay()) {
          messageEvents.push({
              type: 'system', bIncoming: false, message: '<span>' + msg_ts.toDateString()
                  + '</span>', timestamp: Math.floor(msg_ts.getTime() / 1000)
          });
      }
  }

  parseMessage(message) {
      switch (message.type) {
          case 'system':
              message.message = JSON.parse(message.message);
              message.message = '<span>chat recording '
                + (message.message.state ? '&nbsp;' : '')
                + '</span><b dropdown-toggle="#recording-drop">'
                + (message.message.state ? 'ON' : 'OFF')
                + '</b><span class="padding"></span>';
              message.chat_recording_status = true;
              break;
          default:
              message = this.parseMessageBody(message);
              break;
      }
      return message;
  }

  parseMessageBody(message) {
      try {
          message = {
              ...message,
              ...JSON.parse(message.message)
          };
      } catch (e) {
          message.type = MessageType.Text;
          message.id = message.timestamp;
      }

      return message;
  }

  makeMessage(body) {
      const message: Message = {
          type: MessageType.Text,
          id: Date.now(),
          message: body
      };

      return message;
  }

  signMessageFromAddress(message, address, signingDeviceAddresses, cb) {
      const fc = this.profileService.focusedClient;
      if (fc.isPrivKeyEncrypted()) {
          this.profileService.unlockFC(null, (err) => {
              if (err) {
                  return cb(err.message);
              }
              this.signMessageFromAddress(message, address, signingDeviceAddresses, cb);
          });
          return;
      }

      this.profileService.requestTouchid((err) => {
          if (err) {
              this.profileService.lockFC();
              return cb(err);
          }

          const current_message_signing_key = crypto.createHash('sha256').update(address + message).digest('base64');
          if (current_message_signing_key === this.message_signing_key_in_progress) {
              return cb('This message signing is already under way');
          }
          this.message_signing_key_in_progress = current_message_signing_key;
          fc.signMessage(address, message, signingDeviceAddresses, (_err, objSignedMessage) => {
              this.message_signing_key_in_progress = null;
              if (_err) {
                  return cb(_err);
              }
              const signedMessageBase64 = Buffer.from(JSON.stringify(objSignedMessage)).toString('base64');
              cb(null, signedMessageBase64);
          });
      });
  }

  populateScopeWithAttestedFields(scope, my_address, peer_address, cb) {
      const privateProfile = require('ocore/private_profile.js');
      scope.my_first_name = 'FIRST NAME UNKNOWN';
      scope.my_last_name = 'LAST NAME UNKNOWN';
      scope.my_attestor = {};
      scope.peer_first_name = 'FIRST NAME UNKNOWN';
      scope.peer_last_name = 'LAST NAME UNKNOWN';
      scope.peer_attestor = {};
      async.series([(cb2) => {
          privateProfile.getFieldsForAddress(peer_address, ['first_name', 'last_name'],
              lodash.map(this.configService.getSync().realNameAttestorAddresses, (a) => a.address), (profile) => {
                  scope.peer_first_name = profile.first_name || scope.peer_first_name;
                  scope.peer_last_name = profile.last_name || scope.peer_last_name;
                  scope.peer_attestor = {
                      address: profile.attestor_address, attestation_unit: profile.attestation_unit,
                      trusted: !!lodash.find(this.configService.getSync().realNameAttestorAddresses,
                          (attestor) => attestor.address === profile.attestor_address)
                  };
                  cb2();
              });
      }, (cb2) => {
          privateProfile.getFieldsForAddress(my_address, ['first_name', 'last_name'],
              lodash.map(this.configService.getSync().realNameAttestorAddresses, (a) => a.address), (profile) => {
                  scope.my_first_name = profile.first_name || scope.my_first_name;
                  scope.my_last_name = profile.last_name || scope.my_last_name;
                  scope.my_attestor = {
                      address: profile.attestor_address, attestation_unit: profile.attestation_unit,
                      trusted: !!lodash.find(this.configService.getSync().realNameAttestorAddresses,
                          (attestor) => attestor.address === profile.attestor_address)
                  };
                  cb2();
              });
      }], () => {
          cb();
      });
  }

  listenForProsaicContractResponse(contracts = null) {
      const prosaic_contract = require('ocore/prosaic_contract.js');
      const storage = require('ocore/storage.js');
      const fc = this.profileService.focusedClient;

      const showError = (msg) => {
          // $rootScope.$emit('Local/ShowErrorAlert', msg);
      };

      const start_listening = (_contracts) => {
          _contracts.forEach((contract) => {
              console.log('listening for prosaic contract response ' + contract.hash);

              const sendUnit = (accepted, authors) => {
                  // create shared address and deposit some bytes to cover fees
                  const composeAndSend = (shared_address) => {
                      prosaic_contract.setField(contract.hash, 'shared_address', shared_address);
                      device.sendMessageToDevice(contract.peer_device_address, 'prosaic_contract_update', {
                          hash: contract.hash,
                          field: 'shared_address',
                          value: shared_address
                      });
                      contract.cosigners.forEach((cosigner) => {
                          if (cosigner !== device.getMyDeviceAddress()) {
                              prosaic_contract.share(contract.hash, cosigner);
                          }
                      });

                      this.profileService.bKeepUnlocked = true;
                      const opts = {
                          asset: 'base',
                          to_address: shared_address,
                          amount: prosaic_contract.CHARGE_AMOUNT,
                          arrSigningDeviceAddresses: contract.cosigners
                      };
                      fc.sendMultiPayment(opts, (err) => {
                          // if multisig, it might take very long before the callback is called
                          // self.setOngoingProcess();
                          this.profileService.bKeepUnlocked = false;
                          if (err) {
                              if (err.match(/device address/)) {
                                  err = 'This is a private asset, please send it only by clicking links from chat';
                              }
                              if (err.match(/no funded/)) {
                                  err = 'Not enough spendable funds, make sure all your funds are confirmed';
                              }
                              showError(err);
                              return;
                          }

                          // post a unit with contract text hash and send it for signing to correspondent
                          const value = {contract_text_hash: contract.hash};
                          const objMessage = {
                            app: 'data',
                            payload_location: 'inline',
                            payload_hash: objectHash.getBase64Hash(value, storage.getMinRetrievableMci() >= constants.timestampUpgradeMci),
                            payload: value
                          };

                          fc.sendMultiPayment({
                              arrSigningDeviceAddresses: contract.cosigners.length ?
                                contract.cosigners.concat([contract.peer_device_address]) : [],
                              shared_address,
                              messages: [objMessage]
                          }, function(_err, unit) { // can take long if multisig
                              if (_err) {
                                  showError(_err);
                                  return;
                              }
                              prosaic_contract.setField(contract.hash, 'unit', unit);
                              device.sendMessageToDevice(contract.peer_device_address, 'prosaic_contract_update', {
                                  hash: contract.hash,
                                  field: 'unit',
                                  value: unit
                              });
                              const testnet = constants.version.match(/t$/) ? 'testnet' : '';
                              const url = 'https://' + testnet + 'explorer.obyte.org/#' + unit;
                              const text = 'unit with contract hash for "' + contract.title + '" was posted into DAG ' + url;
                              this.addMessageEvent(false, contract.peer_device_address, this.formatOutgoingMessage(text));
                              device.sendMessageToDevice(contract.peer_device_address, 'text', text);
                          });
                      });
                  };
                  if (!accepted) {
                      return;
                  }

                  if (fc.isPrivKeyEncrypted()) {
                      this.profileService.unlockFC(null, (err) => {
                          if (err) {
                              showError(err);
                              return;
                          }
                          sendUnit(accepted, authors);
                      });
                      return;
                  }

                  this.readLastMainChainIndex((err, last_mci) => {
                      if (err) {
                          showError(err);
                          return;
                      }
                      const arrDefinition =
                          ['and', [
                              ['address', contract.my_address],
                              ['address', contract.peer_address]
                          ]];
                      const assocSignersByPath = {
                          'r.0': {
                              address: contract.my_address,
                              member_signing_path: 'r',
                              device_address: device.getMyDeviceAddress()
                          },
                          'r.1': {
                              address: contract.peer_address,
                              member_signing_path: 'r',
                              device_address: contract.peer_device_address
                          }
                      };
                      require('ocore/wallet_defined_by_addresses.js').createNewSharedAddress(arrDefinition, assocSignersByPath, {
                          ifError: (_err) => {
                              showError(_err);
                          },
                          ifOk: (shared_address) => {
                              composeAndSend(shared_address);
                          }
                      });
                  });
              };
              eventBus.once('prosaic_contract_response_received' + contract.hash, sendUnit);
          });
      };

      if (contracts) {
          return start_listening(contracts);
      }
      prosaic_contract.getAllByStatus('pending', (_contracts) => {
          start_listening(_contracts);
      });
  }

  readLastMainChainIndex(cb) {
      if (require('ocore/conf.js').bLight) {
          require('ocore/network.js').requestFromLightVendor('get_last_mci', null, (ws, request, response) => {
              response.error ? cb(response.error) : cb(null, response);
          });
      } else {
          require('ocore/storage.js').readLastMainChainIndex((last_mci) => {
              cb(null, last_mci);
          });
      }
  }

  loadLastMessages() {
    device.readCorrespondents(arrCorrespondents => {
      arrCorrespondents.forEach(correspondent => {
        const deviceAddress = correspondent.device_address;
        chatStorage.load(deviceAddress, 90071992547411, 40, (messages) => {
          for (const i in messages) {
            if (messages.hasOwnProperty(i)) {
              messages[i] = this.parseMessage(messages[i]);
            }
          }
          const lastTextMessage = messages.find(m => m.type !== 'system');
          if (lastTextMessage !== undefined) {
            this.assocLastMessageDateByCorrespondent[deviceAddress] = {
              date: lastTextMessage.creation_date ?
                new Date(lastTextMessage.creation_date).toISOString().substr(0, 19).replace('T', ' ') : '',
              message: lastTextMessage
            };
          }
        });
      });
    });
  }

  list(cb) {
      device.readCorrespondents((arrCorrespondents) => {
          cb(null, arrCorrespondents);
      });
  }

  startWaitingForPairing(cb) {
      device.startWaitingForPairing((pairingInfo) => {
          cb(pairingInfo);
      });
  }

  acceptInvitation(hub_host, device_pubkey, pairing_secret, cb) {
      if (device_pubkey === device.getMyDevicePubKey()) {
          return cb('cannot pair with myself');
      }
      if (!device.isValidPubKey(device_pubkey)) {
          return cb('invalid peer public key');
      }
      // the correspondent will be initially called 'New', we'll rename it as soon as we receive the reverse pairing secret back
      device.addUnconfirmedCorrespondent(device_pubkey, hub_host, 'New', (device_address) => {
          device.startWaitingForPairing((reversePairingInfo) => {
              device.sendPairingMessage(hub_host, device_pubkey, pairing_secret, reversePairingInfo.pairing_secret, {
                  ifOk: cb,
                  ifError: cb
              });
          });
          // this continues in parallel
          // open chat window with the newly added correspondent
          device.readCorrespondent(device_address, (correspondent) => {
          });
      });
  }

  getPairAddress(cb = null): Promise<string> {
      return new Promise((resolve, reject) => {
          this.startWaitingForPairing(paringInfo => {
              const {device_pubkey, hub, pairing_secret} = paringInfo;
              const code = `${device_pubkey}@${hub}#${pairing_secret}`;
              if (cb) {
                  cb(code);
              }
              resolve(code);
          });
      });
  }

  // Pair device with code
  handleCode(code, spinnerFnc) {
      return new Promise((resolve, reject) => {
          let re = new RegExp('^' + conf.program + ':', 'i');
          code = code.replace(re, '');
          re = new RegExp('^' + conf.program.replace(/byteball/i, 'obyte') + ':', 'i');
          code = code.replace(re, '');
          const matches = code.match(/^([\w\/+]+)@([\w.:\/-]+)#(.+)$/);
          if (!matches) {
              return reject('Invalid pairing code');
          }
          const pubkey = matches[1];
          const hub = matches[2];
          const pairing_secret = matches[3];
          if (pubkey.length !== 44) {
              return reject('Invalid pubkey length');
          }

          console.log(pubkey, hub, pairing_secret);
          spinnerFnc(true);
          this.acceptInvitation(hub, pubkey, pairing_secret, (err, data) => {
              spinnerFnc(false);
              if (err) {
                  reject(err);
              } else {
                  resolve(data);
              }
          });
      });
  }

  removeChat(device_address) {
      chatStorage.purge(device_address);
  }

  remove(device_address): Promise<any> {
      return new Promise((resolve, reject) => {
          mutex.lock(['remove_device'], (unlock) => {
              // check to be safe
              wallet.determineIfDeviceCanBeRemoved(device_address, (
                  bRemovable
              ) => {
                  if (!bRemovable) {
                      unlock();
                      return reject(
                          'device ' + device_address + ' is not removable'
                      );
                  }
                  // send message to paired device
                  // this must be done before removing the device
                  device.sendMessageToDevice(
                      device_address,
                      'removed_paired_device',
                      'removed'
                  );

                  // remove device
                  device.removeCorrespondentDevice(
                      device_address,
                      () => {
                          this.removeChat(device_address);
                          unlock();
                          this.currentCorrespondent = null;
                          resolve();
                      }
                  );
              });
          });
      });
  }

  update(item) {
      return new Promise((resolve, reject) => {
          device.updateCorrespondentProps(item, () => {
              resolve(true);
          });
      });
  }

  gettext(value) {
      return value;
  }

  modifyMessage(message: Message, correspondent = null) {
      if (correspondent === null) {
          correspondent = this.currentCorrespondent;
      }
      if (correspondent === null) {
          return;
      }
      const {device_address} = correspondent;
      const messageEvents: Array<Message> = this.messageEventsByCorrespondent[device_address];
      let isFound = false;
      messageEvents.forEach((item, index) => {
          if (!isFound && item.id === message.relatedId) {
              messageEvents[index].message = message.message;
              isFound = true;
          }
      });
  }

  removeMessage(message: Message, correspondent = null) {
      if (correspondent === null) {
          correspondent = this.currentCorrespondent;
      }
      if (correspondent === null) {
          return;
      }
      const {device_address} = correspondent;
      const messageEvents: Array<Message> = this.messageEventsByCorrespondent[device_address];
      let isFound = false;
      messageEvents.forEach((item, index) => {
          if (!isFound && item.id === message.relatedId) {
              messageEvents.splice(index, 1);
              isFound = true;
          }
      });
  }
}
