import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { ChatAddressPage } from './chat-address.page';

describe('ChatAddressPage', () => {
  let component: ChatAddressPage;
  let fixture: ComponentFixture<ChatAddressPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ChatAddressPage ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(ChatAddressPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
