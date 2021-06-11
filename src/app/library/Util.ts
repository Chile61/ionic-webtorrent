import { AlertController } from '@ionic/angular';
// import { resolve } from 'url';
import { APP_NAME, DATA_URL_REPLACE } from './Config';

export function gettext(text) {
  return text;
}

export class GetTextCatalog {
  static getString(text) {
    return text;
  }
}

export function timeout(cb, duration = 0) {
  setTimeout(cb, duration);
}

export async function showAlert(alertCtrl: AlertController, message: string) {
  const alert = await alertCtrl.create({
    header: APP_NAME,
    message,
    buttons: [{
      text: 'Okay',
      handler: () => { }
    }]
  });

  await alert.present();
}

export function showConfirm(alertCtrl: AlertController, message: string): Promise<boolean> {
  return new Promise(async (resolve, reject) => {
    const alert = await alertCtrl.create({
      header: APP_NAME,
      message,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          cssClass: 'secondary',
          handler: (blah) => {
            resolve(false);
          }
        }, {
          text: 'Okay',
          handler: async () => {
            resolve(true);
          }
        }
      ]
    });
    await alert.present();
  });
}

export async function showPrompt(alertCtrl: AlertController, message: string, inputs): Promise<any> {
  return new Promise(async (resolve, reject) => {
    const alert = await alertCtrl.create({
      header: message,
      inputs,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          handler: data => {
            resolve(null);
          }
        },
        {
          text: 'Okay',
          handler: data => {
            resolve(data);
          }
        }
      ]
    });
    await alert.present();
  });
}

export async function sleep(time): Promise<any> {
  return new Promise(async (resolve, reject) => {
    setTimeout(() => resolve(true), time);
  });
}

export async function convertDataURLToImageBuffer(uri) {
  const data = uri.replace(DATA_URL_REPLACE, '');
  return Buffer.from(data, 'base64');
}
