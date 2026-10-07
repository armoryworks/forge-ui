import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthService } from './auth.service';
import { DesktopPreferenceService } from './desktop-preference.service';

describe('DesktopPreferenceService', () => {
  const user = signal<{ id: number } | null>({ id: 1 });
  let service: DesktopPreferenceService;

  beforeEach(() => {
    localStorage.clear();
    user.set({ id: 1 });
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { user } }],
    });
    service = TestBed.inject(DesktopPreferenceService);
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('remembers the choice for the signed-in user', () => {
    expect(service.prefer()).toBe(true);
    expect(service.isPreferred()).toBe(true);
  });

  it('does not carry one user\'s choice over to the next user of the browser', () => {
    service.prefer();
    user.set({ id: 2 });
    expect(service.isPreferred()).toBe(false);
  });

  it('forgets the choice when cleared', () => {
    service.prefer();
    service.clear();
    expect(service.isPreferred()).toBe(false);
  });

  it('stores nothing without a signed-in user', () => {
    user.set(null);
    expect(service.prefer()).toBe(false);
    expect(service.isPreferred()).toBe(false);
  });

  it('reports a blocked write and reads a blocked store as no preference', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(service.prefer()).toBe(false);
    expect(service.isPreferred()).toBe(false);
  });
});
