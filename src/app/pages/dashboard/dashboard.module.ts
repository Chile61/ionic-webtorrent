import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { DashboardPageRoutingModule } from './dashboard-routing.module';

import { DashboardPage } from './dashboard.page';
import { TorrentItemComponent } from 'src/app/components/torrent-item/torrent-item.component';
import { MainWalletComponent } from 'src/app/components/main-wallet/main-wallet.component';
import { OcoreReceiverComponent } from 'src/app/components/ocore-receiver/ocore-receiver.component';
import { OcoreSenderComponent } from 'src/app/components/ocore-sender/ocore-sender.component';
import { TransactionHistoryComponent } from 'src/app/components/transaction-history/transaction-history.component';
import { ViewWalletsComponent } from 'src/app/components/view-wallets/view-wallets.component';
import { SeedFilterComponent } from 'src/app/components/seed-filter/seed-filter.component';
import { FileItemComponent } from 'src/app/components/file-item/file-item.component';
import { VideoItemComponent } from 'src/app/components/video-item/video-item.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    DashboardPageRoutingModule,
  ],
  declarations: [
    DashboardPage,
    TorrentItemComponent,
    FileItemComponent,
    VideoItemComponent,
    MainWalletComponent,
    OcoreReceiverComponent,
    OcoreSenderComponent,
    TransactionHistoryComponent,
    ViewWalletsComponent,
    SeedFilterComponent,
  ]
})
export class DashboardPageModule {}
