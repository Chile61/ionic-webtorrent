import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { SetDevicenamePageRoutingModule } from './set-devicename-routing.module';

import { SetDevicenamePage } from './set-devicename.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    SetDevicenamePageRoutingModule
  ],
  declarations: [SetDevicenamePage]
})
export class SetDevicenamePageModule {}
