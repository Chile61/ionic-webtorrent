import { TestBed } from '@angular/core/testing';

import { TorrentWalletService } from './torrent-wallet.service';

describe('TorrentWalletService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: TorrentWalletService = TestBed.get(TorrentWalletService);
    expect(service).toBeTruthy();
  });
});
