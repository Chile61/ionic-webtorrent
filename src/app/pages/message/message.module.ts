import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { MessagePageRoutingModule } from './message-routing.module';

import { MessagePage } from './message.page';
import { EmojiPickerComponent } from 'src/app/components/emoji-picker/emoji-picker.component';
import { IonicGestureConfig } from 'src/utils/IonicGestureConfig';
import { HAMMER_GESTURE_CONFIG } from '@angular/platform-browser';
import { LongPressModule } from 'ionic-long-press';
import { AutosizeDirective } from 'src/app/directives/autosize.directive';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    MessagePageRoutingModule,
    LongPressModule
  ],
  providers: [
    { provide: HAMMER_GESTURE_CONFIG, useClass: IonicGestureConfig }
  ],
  declarations: [MessagePage, EmojiPickerComponent, AutosizeDirective]
})
export class MessagePageModule { }
