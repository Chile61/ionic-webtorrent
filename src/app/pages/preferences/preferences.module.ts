import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { PreferencesPageRoutingModule } from './preferences-routing.module';

import { PreferencesPage } from './preferences.page';

import { SetDevicenamePageModule } from '../set-devicename/set-devicename.module';
import { RequestPasswordPageModule } from '../request-password/request-password.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    PreferencesPageRoutingModule,
    SetDevicenamePageModule,
    RequestPasswordPageModule,
  ],
  declarations: [PreferencesPage]
})
export class PreferencesPageModule {}
