import { TestBed } from '@angular/core/testing';

import { SecureStorageService } from './secure-storage.service';

describe('SecureStorageService', () => {
  let service: SecureStorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SecureStorageService);
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('round-trips a value through the web fallback', async () => {
    await service.setItem('forge-test-key', 'sealed');
    expect(await service.getItem('forge-test-key')).toBe('sealed');
    expect(localStorage.getItem('forge-test-key')).toBe('sealed');
  });

  it('returns null for a missing key', async () => {
    expect(await service.getItem('forge-absent')).toBeNull();
  });

  it('removes a stored value', async () => {
    await service.setItem('forge-test-key', 'sealed');
    await service.removeItem('forge-test-key');
    expect(await service.getItem('forge-test-key')).toBeNull();
  });
});
