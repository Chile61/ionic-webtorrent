import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { SeedBotPage } from './seed-bot.page';

const routes: Routes = [
  {
    path: '',
    component: SeedBotPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SeedBotPageRoutingModule {}
