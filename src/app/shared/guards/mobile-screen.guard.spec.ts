import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';

import { CapabilityService } from '../services/capability.service';
import { mobileScreenGuard } from './mobile-screen.guard';

describe('mobileScreenGuard', () => {
  const isEnabled = vi.fn<(code: string, fallback?: boolean) => boolean>();

  beforeEach(() => {
    isEnabled.mockReset();
    TestBed.configureTestingModule({
      providers: [{ provide: CapabilityService, useValue: { isEnabled } }],
    });
  });

  const run = (): boolean | UrlTree =>
    TestBed.runInInjectionContext(() =>
      mobileScreenGuard('CAP-MOBILE-SCAN')({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)) as boolean | UrlTree;

  const urlOf = (result: boolean | UrlTree): string => {
    expect(result).toBeInstanceOf(UrlTree);
    return TestBed.inject(Router).serializeUrl(result as UrlTree);
  };

  it('lets the screen through when its flag is on', () => {
    isEnabled.mockReturnValue(true);
    expect(run()).toBe(true);
    expect(isEnabled).toHaveBeenCalledWith('CAP-MOBILE-SCAN', true);
  });

  it('sends a disabled screen to the first screen that is on', () => {
    isEnabled.mockImplementation((code) => code === 'CAP-MOBILE-JOBS' || code === 'CAP-MOBILE-LOOKUP');
    expect(urlOf(run())).toBe('/app/jobs');
  });

  it('sends the person to Account when no phone screen is on', () => {
    isEnabled.mockReturnValue(false);
    expect(urlOf(run())).toBe('/app/account');
  });
});
