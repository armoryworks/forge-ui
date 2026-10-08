import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';

import { of } from 'rxjs';

import { AuthService } from '../../shared/services/auth.service';
import { CapabilityService } from '../../shared/services/capability.service';
import { DesktopPreferenceService } from '../../shared/services/desktop-preference.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { MobileLayoutComponent } from './mobile-layout.component';

interface LayoutInternals {
  tabs: () => { path: string }[];
  desktopReturnUrl: () => string | null;
  ngOnInit(): void;
  openOnDesktop(): void;
  dismissDesktopLink(): void;
}

describe('MobileLayoutComponent', () => {
  const isEnabled = vi.fn();
  const clear = vi.fn();
  const prefer = vi.fn();
  const navigateByUrl = vi.fn();
  const snackbarError = vi.fn();

  const create = (returnUrl: string | null = null): LayoutInternals => {
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { user: signal({ id: 1, roles: [] }), logout: vi.fn() } },
        { provide: HttpClient, useValue: { get: vi.fn(() => of({ isClockedIn: true })) } },
        { provide: Router, useValue: { url: '/m/clock', navigate: vi.fn(), navigateByUrl } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(returnUrl ? { returnUrl } : {}) } },
        },
        { provide: SnackbarService, useValue: { error: snackbarError } },
        provideTranslateService(),
        { provide: CapabilityService, useValue: { isEnabled } },
        { provide: DesktopPreferenceService, useValue: { clear, prefer } },
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

  it('puts My Hours in the bottom nav, open whether or not the caller is clocked in', () => {
    isEnabled.mockReturnValue(true);

    const tabs = create().tabs() as { path: string; labelKey: string; requiresClockedIn?: boolean }[];
    const hours = tabs.find(t => t.path === '/m/time');

    expect(hours).toEqual(expect.objectContaining({ labelKey: 'mobileLegacy.nav.hours' }));
    expect(hours?.requiresClockedIn).toBeFalsy();
    expect(tabs.map(t => t.path)).toEqual(['/m/chat', '/m/jobs', '/m/scan', '/m/clock', '/m/time', '/m/account']);
  });

  it('drops the desktop preference when /m is opened', () => {
    isEnabled.mockReturnValue(true);

    create().ngOnInit();

    expect(clear).toHaveBeenCalled();
  });

  it('offers the desktop page a deep link came from and opens it there', () => {
    isEnabled.mockReturnValue(true);
    prefer.mockReturnValue(true);
    const layout = create('/parts/7?tab=bom');

    layout.ngOnInit();
    expect(layout.desktopReturnUrl()).toBe('/parts/7?tab=bom');

    layout.openOnDesktop();
    expect(prefer).toHaveBeenCalled();
    expect(navigateByUrl).toHaveBeenCalledWith('/parts/7?tab=bom');
  });

  it('stays on /m and says why when the preference cannot be stored', () => {
    isEnabled.mockReturnValue(true);
    prefer.mockReturnValue(false);
    const layout = create('/parts/7');

    layout.ngOnInit();
    layout.openOnDesktop();

    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(snackbarError).toHaveBeenCalledWith('mobileWeb.desktopLink.storageBlocked');
  });

  it('ignores return urls that leave the app or point back into /m', () => {
    isEnabled.mockReturnValue(true);
    for (const url of ['https://evil.example/x', '//evil.example/x', '/m/jobs', '/m?returnUrl=/x', 'parts/7']) {
      TestBed.resetTestingModule();
      const layout = create(url);
      layout.ngOnInit();
      expect(layout.desktopReturnUrl()).toBeNull();
    }
  });

  it('hides the desktop link when dismissed', () => {
    isEnabled.mockReturnValue(true);
    const layout = create('/parts/7');

    layout.ngOnInit();
    layout.dismissDesktopLink();

    expect(layout.desktopReturnUrl()).toBeNull();
  });
});
