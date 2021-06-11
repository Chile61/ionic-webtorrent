import { TestBed } from '@angular/core/testing';

import { FileAccountService } from './file-account.service';

describe('FileAccountService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: FileAccountService = TestBed.get(FileAccountService);
    expect(service).toBeTruthy();
  });
});
