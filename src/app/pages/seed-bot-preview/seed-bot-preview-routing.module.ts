import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { SeedBotPreviewPage } from './seed-bot-preview.page';

const routes: Routes = [
  {
    path: '',
    component: SeedBotPreviewPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SeedBotPreviewPageRoutingModule {}
