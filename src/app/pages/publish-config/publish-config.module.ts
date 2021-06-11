import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { PublishConfigPageRoutingModule } from './publish-config-routing.module';

import { PublishConfigPage } from './publish-config.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    PublishConfigPageRoutingModule
  ],
  declarations: [PublishConfigPage]
})
export class PublishConfigPageModule {}
