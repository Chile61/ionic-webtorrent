import { TestBed } from '@angular/core/testing';

import { FileTransService } from './file-trans.service';

describe('FileTransService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: FileTransService = TestBed.get(FileTransService);
    expect(service).toBeTruthy();
  });
});
