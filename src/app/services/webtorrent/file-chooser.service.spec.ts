import { TestBed } from '@angular/core/testing';

import { FileChooserService } from './file-chooser.service';

describe('FileChooserService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: FileChooserService = TestBed.get(FileChooserService);
    expect(service).toBeTruthy();
  });
});
