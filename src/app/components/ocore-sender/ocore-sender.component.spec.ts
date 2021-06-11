import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { OcoreSenderComponent } from './ocore-sender.component';

describe('OcoreSenderComponent', () => {
  let component: OcoreSenderComponent;
  let fixture: ComponentFixture<OcoreSenderComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ OcoreSenderComponent ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(OcoreSenderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
