import { TestBed } from '@angular/core/testing';

import { PlatformService } from './platform.service';

describe('PlatformService', () => {
  let service: PlatformService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PlatformService);
  });

  it('reports web platform in a browser test environment', () => {
    expect(service.isNative).toBe(false);
    expect(service.name).toBe('web');
    expect(service.isIos).toBe(false);
    expect(service.isAndroid).toBe(false);
  });
});
