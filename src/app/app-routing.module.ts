import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'splash',
    pathMatch: 'full'
  },
  // {
  //   path: 'folder/:id',
  //   loadChildren: () => import('./folder/folder.module').then( m => m.FolderPageModule)
  // },
  {
    path: 'dashboard',
    loadChildren: () => import('./pages/dashboard/dashboard.module').then( m => m.DashboardPageModule)
  },
  {
    path: 'preferences',
    loadChildren: () => import('./pages/preferences/preferences.module').then( m => m.PreferencesPageModule)
  },
  {
    path: 'splash',
    loadChildren: () => import('./pages/splash/splash.module').then( m => m.SplashPageModule)
  },
  {
    path: 'address-book',
    loadChildren: () => import('./pages/address-book/address-book.module').then( m => m.AddressBookPageModule)
  },
  {
    path: 'chat-address',
    loadChildren: () => import('./pages/chat-address/chat-address.module').then( m => m.ChatAddressPageModule)
  },
  {
    path: 'backup-wallet',
    loadChildren: () => import('./pages/backup-wallet/backup-wallet.module').then( m => m.BackupWalletPageModule)
  },
  {
    path: 'recover-wallet',
    loadChildren: () => import('./pages/recover-wallet/recover-wallet.module').then( m => m.RecoverWalletPageModule)
  },
  {
    path: 'seed-bot',
    loadChildren: () => import('./pages/seed-bot/seed-bot.module').then( m => m.SeedBotPageModule)
  },
  {
    path: 'seed-bot-preview',
    loadChildren: () => import('./pages/seed-bot-preview/seed-bot-preview.module').then( m => m.SeedBotPreviewPageModule)
  },
  {
    path: 'transaction',
    loadChildren: () => import('./pages/transaction/transaction.module').then( m => m.TransactionPageModule)
  },
  {
    path: 'message',
    loadChildren: () => import('./pages/message/message.module').then( m => m.MessagePageModule)
  },
  {
    path: 'media-call',
    loadChildren: () => import('./pages/media-call/media-call.module').then( m => m.MediaCallPageModule)
  },
  {
    path: 'publish-config',
    loadChildren: () => import('./pages/publish-config/publish-config.module').then( m => m.PublishConfigPageModule)
  },
  {
    path: 'log-in',
    loadChildren: () => import('./pages/log-in/log-in.module').then( m => m.LogInPageModule)
  },  {
    path: 'request-password',
    loadChildren: () => import('./pages/request-password/request-password.module').then( m => m.RequestPasswordPageModule)
  },
  {
    path: 'transaction-history',
    loadChildren: () => import('./pages/transaction-history/transaction-history.module').then( m => m.TransactionHistoryPageModule)
  }


];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}
