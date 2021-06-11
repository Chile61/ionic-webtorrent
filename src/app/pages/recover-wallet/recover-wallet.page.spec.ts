import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { RecoverWalletPage } from './recover-wallet.page';

describe('RecoverWalletPage', () => {
  let component: RecoverWalletPage;
  let fixture: ComponentFixture<RecoverWalletPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ RecoverWalletPage ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(RecoverWalletPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
