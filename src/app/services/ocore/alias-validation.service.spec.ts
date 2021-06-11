import { TestBed } from '@angular/core/testing';

import { AliasValidationService } from './alias-validation.service';

describe('AliasValidationService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: AliasValidationService = TestBed.get(AliasValidationService);
    expect(service).toBeTruthy();
  });
});
