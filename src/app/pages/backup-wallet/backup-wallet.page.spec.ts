import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { BackupWalletPage } from './backup-wallet.page';

describe('BackupWalletPage', () => {
  let component: BackupWalletPage;
  let fixture: ComponentFixture<BackupWalletPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ BackupWalletPage ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(BackupWalletPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
