import { TestBed } from '@angular/core/testing';

import { WitnessService } from './witness.service';

describe('WitnessService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: WitnessService = TestBed.get(WitnessService);
    expect(service).toBeTruthy();
  });
});
