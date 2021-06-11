import { Component, OnInit, Input, EventEmitter, Output, OnDestroy } from '@angular/core';
import { WalletService } from 'src/app/services/ocore/wallet.service';
import { ProfileService } from 'src/app/services/ocore/profile.service';
import moment from 'moment';
import { EventService } from 'src/app/services/ocore/event.service';
import { Subscription } from 'rxjs';
import { Router, NavigationExtras } from '@angular/router';
import { NotificationService } from 'src/app/services/notification.service';

@Component({
  selector: 'app-transaction-history',
  templateUrl: './transaction-history.component.html',
  styleUrls: ['./transaction-history.component.scss'],
})
export class TransactionHistoryComponent implements OnInit, OnDestroy {
  @Input()
  address: string;

  @Output() changeMainWalletTabEvent: EventEmitter<number> = new EventEmitter();

  client;
  transactionHistories = [];
  isLoaded = false;

  subscription: Subscription;

  constructor(
    private profileService: ProfileService,
    private walletService: WalletService,
    private eventService: EventService,
    private notificationService: NotificationService,
    private router: Router
  ) {
  }

  ngOnInit() {
    this.client = this.profileService.getClientByIndex(0);
    this.subscription = this.eventService.ocoreEvents.subscribe((value) => {
      if (value !== 'update_transaction') { return; }
      this.getHistory();
      this.notificationService.removeTransaction();
    });
    this.getHistory();
    this.notificationService.removeTransaction();

    this.eventService.isDisableTransaction = true;
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
    this.eventService.isDisableTransaction = false;
  }

  getHistory() {
    this.walletService.getLocalTxHistoryByAddress(this.client, this.address, ({completeHistory}, err) => {
      this.isLoaded = true;
      if (err) {
        // alert(JSON.stringify(err));
        this.transactionHistories = [];
        return;
      }
      this.transactionHistories = completeHistory;
    });

  }

  getHumanDate(date) {
    const duration = Date.now() - date * 1000;
    return moment.duration(duration / 1000, 'seconds').humanize();
  }

  onSelect(history, index) {
    const extras: NavigationExtras = {
      queryParams: {
        address: this.address,
        data: JSON.stringify(history)
      }
    };
    this.router.navigate(['transaction'], extras);
  }
}
