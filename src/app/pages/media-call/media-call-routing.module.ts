import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { MediaCallPage } from './media-call.page';

const routes: Routes = [
  {
    path: '',
    component: MediaCallPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MediaCallPageRoutingModule {}
