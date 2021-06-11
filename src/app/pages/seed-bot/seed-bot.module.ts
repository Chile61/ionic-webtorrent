import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { SeedBotPageRoutingModule } from './seed-bot-routing.module';

import { SeedBotPage } from './seed-bot.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SeedBotPageRoutingModule
  ],
  declarations: [SeedBotPage]
})
export class SeedBotPageModule {}
