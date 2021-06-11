import { TestBed } from '@angular/core/testing';

import { WebtorrentService } from './webtorrent.service';

describe('WebtorrentService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: WebtorrentService = TestBed.get(WebtorrentService);
    expect(service).toBeTruthy();
  });
});
