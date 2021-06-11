import { Component, OnInit, Input, EventEmitter, Output } from '@angular/core';
import { WalletService } from 'src/app/services/ocore/wallet.service';

@Component({
  selector: 'app-view-wallets',
  templateUrl: './view-wallets.component.html',
  styleUrls: ['./view-wallets.component.scss'],
})
export class ViewWalletsComponent implements OnInit {
  @Input()
  index: number;

  @Output() changeMainWalletTabEvent: EventEmitter<number> = new EventEmitter();

  fullWallet = [];
  isLoaded = false;

  constructor(
    private walletService: WalletService,
  ) {
  }

  ngOnInit() {
    this.getWallet();
  }

  getWallet() {
    this.walletService.getWalletBalances((walletBalances, err) => {
      this.isLoaded = true;
      if (err) {
          // alert(JSON.stringify(err));
          this.fullWallet = [];
          return;
      }

      for (const [key, value] of Object.entries(walletBalances)) {
        this.fullWallet.push(value[0]);
      }
    });
  }
}
