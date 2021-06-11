import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { PublishConfigPage } from './publish-config.page';

describe('PublishConfigPage', () => {
  let component: PublishConfigPage;
  let fixture: ComponentFixture<PublishConfigPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ PublishConfigPage ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(PublishConfigPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
