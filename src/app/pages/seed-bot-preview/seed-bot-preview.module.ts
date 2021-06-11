import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { SeedBotPreviewPageRoutingModule } from './seed-bot-preview-routing.module';

import { SeedBotPreviewPage } from './seed-bot-preview.page';
import { DeviceAddressComponent } from 'src/app/components/device-address/device-address.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SeedBotPreviewPageRoutingModule
  ],
  declarations: [SeedBotPreviewPage, DeviceAddressComponent]
})
export class SeedBotPreviewPageModule {}
