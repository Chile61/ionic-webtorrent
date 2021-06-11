import { TestBed } from '@angular/core/testing';

import { ImportVideoService } from './import-video.service';

describe('ImportVideoService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: ImportVideoService = TestBed.get(ImportVideoService);
    expect(service).toBeTruthy();
  });
});
