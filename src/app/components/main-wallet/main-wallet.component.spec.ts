import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { MainWalletComponent } from './main-wallet.component';

describe('MainWalletComponent', () => {
  let component: MainWalletComponent;
  let fixture: ComponentFixture<MainWalletComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ MainWalletComponent ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(MainWalletComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
