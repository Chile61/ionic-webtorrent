import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LogService {

  constructor() { }

  debug(...args: any[]) {
    args.forEach(arg => console.debug(arg));
  }

  log(...args: any[]) {
    args.forEach(arg => console.log(arg));
  }

  info(...args: any[]) {
    args.forEach(arg => console.info(arg));
  }

  warn(...args: any[]) {
    args.forEach(arg => console.warn(arg));
  }
}
