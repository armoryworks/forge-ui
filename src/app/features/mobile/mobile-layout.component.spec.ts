import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

import { of } from 'rxjs';

import { AuthService } from '../../shared/services/auth.service';
import { CapabilityService } from '../../shared/services/capability.service';
import { DesktopPreferenceService } from '../../shared/services/desktop-preference.service';
import { MobileLayoutComponent } from './mobile-layout.component';

interface LayoutInternals {
  tabs: () => { path: string }[];
  ngOnInit(): void;
}

describe('MobileLayoutComponent', () => {
  const isEnabled = vi.fn();
  const clear = vi.fn();

  const create = (): LayoutInternals => {
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { user: signal({ id: 1, roles: [] }), logout: vi.fn() } },
        { provide: HttpClient, useValue: { get: vi.fn(() => of({ isClockedIn: true })) } },
        { provide: Router, useValue: { url: '/m/clock', navigate: vi.fn() } },
        { provide: CapabilityService, useValue: { isEnabled } },
        { provide: DesktopPreferenceService, useValue: { clear } },
      ],
    });
    return TestBed.runInInjectionContext(() => new MobileLayoutComponent()) as unknown as LayoutInternals;
  };

  beforeEach(() => vi.clearAllMocks());

  it('shows the Scan tab when shop-floor execution is on', () => {
    isEnabled.mockReturnValue(true);

    expect(create().tabs().map(t => t.path)).toContain('/m/scan');
    expect(isEnabled).toHaveBeenCalledWith('CAP-MFG-SHOPFLOOR', true);
  });

  it('hides the Scan tab when shop-floor execution is off', () => {
    isEnabled.mockReturnValue(false);

    const paths = create().tabs().map(t => t.path);

    expect(paths).not.toContain('/m/scan');
    expect(paths).toContain('/m/clock');
  });

  it('drops the desktop preference when /m is opened', () => {
    isEnabled.mockReturnValue(true);

    create().ngOnInit();

    expect(clear).toHaveBeenCalled();
  });
});
