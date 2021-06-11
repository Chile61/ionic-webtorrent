import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { LogInPage } from './log-in.page';

describe('LogInPage', () => {
  let component: LogInPage;
  let fixture: ComponentFixture<LogInPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ LogInPage ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(LogInPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
