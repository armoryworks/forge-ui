import { TestBed } from '@angular/core/testing';

import { TokenStorageService } from './token-storage.service';

describe('TokenStorageService', () => {
  let service: TokenStorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TokenStorageService);
    localStorage.clear();
  });

  afterEach(() => localStorage.clear());

  it('reads and writes through localStorage on web', () => {
    service.set('forge-token', 'jwt-value');
    expect(service.get('forge-token')).toBe('jwt-value');
    expect(localStorage.getItem('forge-token')).toBe('jwt-value');

    service.remove('forge-token');
    expect(service.get('forge-token')).toBeNull();
    expect(localStorage.getItem('forge-token')).toBeNull();
  });

  it('hydrate is a no-op on web', async () => {
    await expect(service.hydrate()).resolves.toBeUndefined();
  });
});
