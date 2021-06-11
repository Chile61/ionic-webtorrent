import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { PublishConfigPage } from './publish-config.page';

const routes: Routes = [
  {
    path: '',
    component: PublishConfigPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PublishConfigPageRoutingModule {}
