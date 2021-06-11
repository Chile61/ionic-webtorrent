import { TestBed } from '@angular/core/testing';

import { TxFormatService } from './tx-format.service';

describe('TxFormatService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: TxFormatService = TestBed.get(TxFormatService);
    expect(service).toBeTruthy();
  });
});
