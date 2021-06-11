import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { RecoverWalletPage } from './recover-wallet.page';

const routes: Routes = [
  {
    path: '',
    component: RecoverWalletPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class RecoverWalletPageRoutingModule {}
