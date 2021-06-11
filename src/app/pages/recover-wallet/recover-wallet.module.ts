import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { File } from '@ionic-native/file/ngx';
import { IonicModule } from '@ionic/angular';

import { RecoverWalletPageRoutingModule } from './recover-wallet-routing.module';

import { RecoverWalletPage } from './recover-wallet.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RecoverWalletPageRoutingModule
  ],
  providers: [
    File,
  ],
  declarations: [RecoverWalletPage]
})
export class RecoverWalletPageModule {}
