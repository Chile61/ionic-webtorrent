import { TestBed } from '@angular/core/testing';

import { OcoreConfigService } from './ocore-config.service';

describe('OcoreConfigService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: OcoreConfigService = TestBed.get(OcoreConfigService);
    expect(service).toBeTruthy();
  });
});
