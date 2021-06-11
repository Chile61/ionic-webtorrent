import { Injectable } from '@angular/core';
import { StorageService } from './ocore/storage.service';
import { Badge } from '@ionic-native/badge/ngx';
import { LocalNotifications } from '@ionic-native/local-notifications/ngx';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {

  static Transaction = 0;
  static Message = 1;

  notificationStorageKey = 'Notifications';
  list = [];

  constructor(
    private storageService: StorageService,
    private badge: Badge,
    private localNotifications: LocalNotifications
  ) {
  }

  async init() {
    this.list = await this.storageService.get(this.notificationStorageKey, []);
    this.setBadge();
  }

  async save() {
    await this.storageService.set(this.notificationStorageKey, this.list);
  }

  addTransaction(key) {
    const id = Date.now();
    const isAdded = this.add(NotificationService.Transaction, {
      key, id
    });
    if (!isAdded) { return; }

    this.localNotifications.schedule({
      id,
      title: 'New Transaction',
      badge: this.getCount(),
      icon: 'file://assets/icon/transaction-message.png',
      sound: 'file://assets/sounds/drop.mp3',
    });
  }

  addMessage(userId, message) {
    this.add(NotificationService.Message, { userId, message });
    this.localNotifications.schedule({
      // id: userId,
      title: 'New Message',
      text: message,
      badge: this.getCount(),
      icon: 'file://assets/icon/chat-message.png',
      sound: 'file://assets/sounds/drop.mp3'
    });
  }

  add(type, data) {
    for (let i = 0; i < this.getCount(); i++) {
      if (NotificationService.Message === this.list[i].type) {
        const { userId, message } = this.list[i].data;
        if (userId === data.userId &&
          message === data.message) { return false; }
      } else { // Transaction
        const { key, id } = this.list[i].data;
        if (data.key === key) { return false; }
      }
    }

    this.list.push({
      type,
      data
    });
    this.setBadge();
    return true;
  }

  getCount() {
    return this.list.length;
  }

  getMessageCount(userId) {
    let count = 0;
    this.list.forEach(({ type, data }) => {
      if (type !== NotificationService.Message) { return; }
      if (userId === null || data.userId === userId) { count++; }
    });
    return count;
  }

  getTransactionCount() {
    let count = 0;
    this.list.forEach(({ type, data }) => {
      if (type !== NotificationService.Transaction) { return; }
      count++;
    });
    return count;
  }

  removeTransaction() {
    this.remove(NotificationService.Transaction);
  }

  remove(type) {
    for (let i = 0; i < this.getCount(); i++) {
      if (type === this.list[i].type) {
        const { data } = this.list[i];
        if (type === NotificationService.Transaction) {
          this.localNotifications.cancel(data.id);
          this.localNotifications.clear(data.id);
        }
        this.list.splice(i, 1);
        i--;
      }
    }
    this.setBadge();
  }

  removeMessage(id) {
    for (let i = 0; i < this.getCount(); i++) {
      if (NotificationService.Message !== this.list[i].type) { continue; }

      const { userId } = this.list[i].data;
      if (userId === id) {
        this.list.splice(i, 1);
        i--;
      }
    }
    this.setBadge();
  }

  setBadge() {
    if (this.getCount()) {
      this.badge.set(this.getCount());
    } else { this.badge.clear(); }
    this.save();
  }
  getLastMessage(id) {
    return this.list;
  }
}
