import { TestBed } from '@angular/core/testing';

import { ConsultantModeService } from './consultant-mode.service';

describe('ConsultantModeService — Phase 4 Phase-E UI flag', () => {
  let service: ConsultantModeService;

  beforeEach(() => {
    // Make sure each test starts with no persisted flag.
    try {
      localStorage.removeItem('qb-engineer:consultant-mode');
    } catch {
      // ignore
    }
    TestBed.configureTestingModule({});
    service = TestBed.inject(ConsultantModeService);
  });

  it('defaults to disabled when no localStorage value is present', () => {
    expect(service.enabled()).toBe(false);
  });

  it('toggle flips the signal and persists to localStorage', () => {
    service.toggle();
    expect(service.enabled()).toBe(true);
    expect(localStorage.getItem('qb-engineer:consultant-mode')).toBe('1');

    service.toggle();
    expect(service.enabled()).toBe(false);
    expect(localStorage.getItem('qb-engineer:consultant-mode')).toBeNull();
  });

  it('set(true|false) updates the signal explicitly', () => {
    service.set(true);
    expect(service.enabled()).toBe(true);
    service.set(false);
    expect(service.enabled()).toBe(false);
  });
});
