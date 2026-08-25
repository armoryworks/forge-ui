import { TestBed } from '@angular/core/testing';

import { TlsPinService } from './tls-pin.service';

describe('TlsPinService', () => {
  let service: TlsPinService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TlsPinService);
  });

  it('normalizes colon-separated and uppercase fingerprints', () => {
    expect(TlsPinService.normalize('AB:CD:ef:01')).toBe('abcdef01');
  });

  it('skips the check on web where the browser owns TLS', async () => {
    await expect(service.assertPinned('https://shop.example.com', 'ab'.repeat(32))).resolves.toBeUndefined();
  });

  it('skips when the instance publishes no pin', async () => {
    await expect(service.assertPinned('https://shop.example.com', null)).resolves.toBeUndefined();
  });
});
