import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { SeedBotPreviewPage } from './seed-bot-preview.page';

describe('SeedBotPreviewPage', () => {
  let component: SeedBotPreviewPage;
  let fixture: ComponentFixture<SeedBotPreviewPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ SeedBotPreviewPage ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(SeedBotPreviewPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
