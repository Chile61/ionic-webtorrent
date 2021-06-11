import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { SeedBotPage } from './seed-bot.page';

describe('SeedBotPage', () => {
  let component: SeedBotPage;
  let fixture: ComponentFixture<SeedBotPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ SeedBotPage ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(SeedBotPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
