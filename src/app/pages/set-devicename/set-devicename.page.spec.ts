import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { SetDevicenamePage } from './set-devicename.page';

describe('SetDevicenamePage', () => {
  let component: SetDevicenamePage;
  let fixture: ComponentFixture<SetDevicenamePage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ SetDevicenamePage ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(SetDevicenamePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
