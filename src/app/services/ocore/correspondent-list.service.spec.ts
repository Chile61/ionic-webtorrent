import { TestBed } from '@angular/core/testing';

import { CorrespondentListService } from './correspondent-list.service';

describe('CorrespondentListService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: CorrespondentListService = TestBed.get(CorrespondentListService);
    expect(service).toBeTruthy();
  });
});
