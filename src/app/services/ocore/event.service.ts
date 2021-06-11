import { Injectable, EventEmitter } from '@angular/core';
import eventBus from 'ocore/event_bus.js';
import { NotificationService } from '../notification.service';
import { Toast } from '@ionic-native/toast/ngx';
import chatStorage from 'ocore/chat_storage.js';

@Injectable({
  providedIn: 'root'
})
export class EventService {
  // event: EventEmitter<string>;
  listeners: Map<string, any>;
  ocoreEvents: EventEmitter<string>;

  isDisableTransaction = false;
  isInit = false;

  constructor(
    private notificationService: NotificationService,
    private toast: Toast
  ) { }

  init() {
    if (this.isInit) { return; }

    this.isInit = true;
    this.listeners = new Map<string, any>();
    this.ocoreEvents = new EventEmitter<string>();

    eventBus.on('connected', () => {
      this.ocoreEvents.emit('connected');
      this.toast.show('Network connection is connected successfully.', '2000', 'bottom').subscribe();
    });

    eventBus.on('new_my_transactions', (arrNewUnits) => {
      if (!this.isDisableTransaction) { this.notificationService.addTransaction(arrNewUnits[0]); }
      this.ocoreEvents.emit('update_transaction');
    });
    eventBus.on('my_transactions_became_stable', () => this.ocoreEvents.emit('update_transaction'));
    eventBus.on('maybe_new_transactions', () => this.ocoreEvents.emit('update_transaction'));

    eventBus.on('paired', () => this.ocoreEvents.emit('update_pairing'));
    eventBus.on('removed_paired_device', (from_address) => {
      chatStorage.purge(from_address);
      this.ocoreEvents.emit('update_pairing');
    });
  }

  emit(key: string, ...args) {
    // this.event.emit(value);
    if (this.listeners.has(key)) {
      this.listeners.get(key)(...args);
    }
  }

  on(key: string, cb: any) {
    this.listeners.set(key, cb);
    return this.remove.bind(this, key);
  }

  remove(key: string) {
    this.listeners.delete(key);
  }
}
