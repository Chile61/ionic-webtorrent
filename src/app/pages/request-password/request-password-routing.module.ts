import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { RequestPasswordPage } from './request-password.page';

const routes: Routes = [
  {
    path: '',
    component: RequestPasswordPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class RequestPasswordPageRoutingModule {}
