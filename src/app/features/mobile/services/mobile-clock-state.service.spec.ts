import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { MobileClockStateService } from './mobile-clock-state.service';

describe('MobileClockStateService', () => {
  let service: MobileClockStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MobileClockStateService);
  });

  it('initializes isClockedIn to false', () => {
    expect(service.isClockedIn()).toBe(false);
  });

  it('initializes checkDone to false', () => {
    expect(service.checkDone()).toBe(false);
  });

  it('update(true) sets isClockedIn to true', () => {
    service.update(true);
    expect(service.isClockedIn()).toBe(true);
  });

  it('update(false) sets isClockedIn to false', () => {
    service.update(true);
    service.update(false);
    expect(service.isClockedIn()).toBe(false);
  });

  it('update() sets checkDone to true regardless of clockedIn value', () => {
    service.update(false);
    expect(service.checkDone()).toBe(true);
  });

  it('update(true) sets both isClockedIn and checkDone', () => {
    service.update(true);
    expect(service.isClockedIn()).toBe(true);
    expect(service.checkDone()).toBe(true);
  });

  it('checkDone remains true after subsequent update calls', () => {
    service.update(true);
    service.update(false);
    expect(service.checkDone()).toBe(true);
  });
});
