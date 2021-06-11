import { TestBed } from '@angular/core/testing';

import { UxLanguageService } from './ux-language.service';

describe('UxLanguageService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: UxLanguageService = TestBed.get(UxLanguageService);
    expect(service).toBeTruthy();
  });
});
