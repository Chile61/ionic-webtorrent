import { TestBed } from '@angular/core/testing';

import { PairedAddressService } from './paired-address.service';

describe('PairedAddressService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: PairedAddressService = TestBed.get(PairedAddressService);
    expect(service).toBeTruthy();
  });
});
