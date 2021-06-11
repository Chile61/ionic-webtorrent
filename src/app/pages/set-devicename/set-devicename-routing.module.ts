import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { SetDevicenamePage } from './set-devicename.page';

const routes: Routes = [
  {
    path: '',
    component: SetDevicenamePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SetDevicenamePageRoutingModule {}
