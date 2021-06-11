import { TestBed } from '@angular/core/testing';

import { BwcService } from './bwc.service';

describe('BwcService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: BwcService = TestBed.get(BwcService);
    expect(service).toBeTruthy();
  });
});
