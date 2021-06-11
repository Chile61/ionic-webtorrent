import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { BackupWalletPageRoutingModule } from './backup-wallet-routing.module';

import { BackupWalletPage } from './backup-wallet.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BackupWalletPageRoutingModule
  ],
  declarations: [BackupWalletPage]
})
export class BackupWalletPageModule {}
