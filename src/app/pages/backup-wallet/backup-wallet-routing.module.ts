import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { BackupWalletPage } from './backup-wallet.page';

const routes: Routes = [
  {
    path: '',
    component: BackupWalletPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class BackupWalletPageRoutingModule {}
