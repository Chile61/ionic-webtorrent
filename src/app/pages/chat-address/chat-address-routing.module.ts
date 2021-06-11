import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ChatAddressPage } from './chat-address.page';

const routes: Routes = [
  {
    path: '',
    component: ChatAddressPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ChatAddressPageRoutingModule {}
