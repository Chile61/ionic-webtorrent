import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { MediaCallPageRoutingModule } from './media-call-routing.module';

import { MediaCallPage } from './media-call.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    MediaCallPageRoutingModule
  ],
  declarations: [MediaCallPage]
})
export class MediaCallPageModule {}
