import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import {Validators, FormBuilder, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-set-devicename',
  templateUrl: './set-devicename.page.html',
  styleUrls: ['./set-devicename.page.scss'],
})
export class SetDevicenamePage implements OnInit {
  deviceName;

  public deviceForm: FormGroup;
  constructor(
    private formBuilder: FormBuilder,
    private modalController: ModalController,
  ) { }

  ngOnInit() {
    this.deviceForm = this.formBuilder.group({
      name: [this.deviceName ? this.deviceName : '', Validators.required]
    });
  }

  dismiss(res) {
    this.modalController.dismiss({
      deviceName: res
    });
  }

  onChangeDevice() {
    const { name } = this.deviceForm.value;
    this.dismiss(name);
  }
}
