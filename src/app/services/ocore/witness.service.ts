import { Injectable } from '@angular/core';
import witnesses from 'ocore/my_witnesses.js';

@Injectable({
  providedIn: 'root'
})
export class WitnessService {
  currentWitness = null;
  witnesses = null;

  constructor() {
  }

  init() {
    witnesses.readMyWitnesses((arrWitnesses) => {
      this.witnesses = arrWitnesses;
    });
  }
}
