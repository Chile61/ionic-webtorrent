import moment from 'moment';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationExtras, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { NotificationService } from 'src/app/services/notification.service';
import { EventService } from 'src/app/services/ocore/event.service';
import { ProfileService } from 'src/app/services/ocore/profile.service';
import { WalletService } from 'src/app/services/ocore/wallet.service';

@Component({
  selector: 'app-transaction-history',
  templateUrl: './transaction-history.page.html',
  styleUrls: ['./transaction-history.page.scss'],
})
export class TransactionHistoryPage implements OnInit, OnDestroy {
  address = '';
  title = '';

  client;
  transactionHistories = [];
  isLoaded = false;

  subscription: Subscription;

  constructor(
    private activeRoute: ActivatedRoute,
    private profileService: ProfileService,
    private walletService: WalletService,
    private eventService: EventService,
    private notificationService: NotificationService,
    private router: Router
  ) { }

  ngOnInit() {
    this.activeRoute.queryParams.subscribe(params => {
      this.address = params.address;
      this.title = params.title || this.address;
      this.init();
    });
  }

  init() {
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
    this.walletService.getLocalTxHistoryByAddress(this.client, this.address, ({ completeHistory }, err) => {
      this.isLoaded = true;
      if (err) {
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
