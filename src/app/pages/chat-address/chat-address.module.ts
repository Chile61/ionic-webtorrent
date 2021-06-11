import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ChatAddressPageRoutingModule } from './chat-address-routing.module';

import { ChatAddressPage } from './chat-address.page';
import { LongPressModule } from 'ionic-long-press';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ChatAddressPageRoutingModule,
    LongPressModule
  ],
  declarations: [ChatAddressPage]
})
export class ChatAddressPageModule {}
