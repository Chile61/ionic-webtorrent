import { TestBed } from '@angular/core/testing';

import { ImportYoutubeService } from './import-youtube.service';

describe('ImportYoutubeService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: ImportYoutubeService = TestBed.get(ImportYoutubeService);
    expect(service).toBeTruthy();
  });
});
