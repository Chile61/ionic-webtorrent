import { TestBed } from '@angular/core/testing';

import { RecoveryFromSeedService } from './recovery-from-seed.service';

describe('RecoveryFromSeedService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: RecoveryFromSeedService = TestBed.get(RecoveryFromSeedService);
    expect(service).toBeTruthy();
  });
});
