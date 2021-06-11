import { Component, OnInit, OnChanges, OnDestroy, EventEmitter, Output, Input } from '@angular/core';
import { Router } from '@angular/router';
import { WalletService } from 'src/app/services/ocore/wallet.service';
import { EventService } from 'src/app/services/ocore/event.service';
import { Subscription } from 'rxjs';
import { NotificationService } from 'src/app/services/notification.service';

@Component({
  selector: 'app-main-wallet',
  templateUrl: './main-wallet.component.html',
  styleUrls: ['./main-wallet.component.scss'],
})
export class MainWalletComponent implements OnInit, OnDestroy, OnChanges {

  @Output() changeVisible: EventEmitter<any> = new EventEmitter();

  @Input()
  expand: boolean;

  isShowToolbar = false;
  tabIndex = -1;
  balance = { amount: '0.0 GSC' };
  subscription: Subscription;
  address = '';

  get chatBadgeNumber() {
    return this.notificationService.getMessageCount(null);
  }

  get txsBadgeNumber() {
    return this.notificationService.getTransactionCount();
  }

  constructor(
    private router: Router,
    private walletService: WalletService,
    private eventService: EventService,
    private notificationService: NotificationService
  ) { }

  async ngOnInit() {
    this.getBalance();

    this.subscription = this.eventService.ocoreEvents.subscribe((value) => {
      if (value === 'connected' ||
        value === 'update_transaction') {
        this.getBalance();
      }
    });

    this.eventService.on('open_payment_send', (address) => {
      this.isShowToolbar = true;
      this.tabIndex = 2;
      setTimeout(() => this.eventService.emit('onSelectAddress', address), 100);
    });

    this.address = await this.walletService.getWalletAddressByIndex(0);
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  ngOnChanges() {
    if (this.isShowToolbar === this.expand) { return; }
    this.isShowToolbar = this.expand;
    if (!this.isShowToolbar) {
      this.onClose();
    }
  }

  getBalance() {
    this.walletService.getFocusedWalletBalance().then(balance => {
      this.balance = balance;
    });
  }

  onToggleToolbar() {
    this.isShowToolbar = !this.isShowToolbar;
    if (!this.isShowToolbar) { this.tabIndex = -1; }
    this.changeVisible.emit(this.isShowToolbar);
  }

  onSeedWeb() {}

  onSeedNet() {
    this.router.navigateByUrl('seed-bot');
  }

  onChat() {
    this.router.navigateByUrl('chat-address');
  }

  onTab(index: number) {
    this.tabIndex = index;
  }

  onClose() {
    if (this.tabIndex !== -1) { this.tabIndex = -1; } else {
      this.isShowToolbar = false;
      this.changeVisible.emit(this.isShowToolbar);
    }
  }
}
