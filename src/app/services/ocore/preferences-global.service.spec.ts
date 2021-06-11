import { TestBed } from '@angular/core/testing';

import { PreferencesGlobalService } from './preferences-global.service';

describe('PreferencesGlobalService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: PreferencesGlobalService = TestBed.get(PreferencesGlobalService);
    expect(service).toBeTruthy();
  });
});
