import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { MediaCallPage } from './media-call.page';

describe('MediaCallPage', () => {
  let component: MediaCallPage;
  let fixture: ComponentFixture<MediaCallPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ MediaCallPage ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(MediaCallPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
