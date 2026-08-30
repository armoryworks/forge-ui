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
      mobileScreenGuard('CAP-MOBILE-CLOCK')({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)) as boolean | UrlTree;

  it('lets the screen through when its flag is on', () => {
    isEnabled.mockReturnValue(true);
    expect(run()).toBe(true);
    expect(isEnabled).toHaveBeenCalledWith('CAP-MOBILE-CLOCK', true);
  });

  it('sends a disabled screen to Account', () => {
    isEnabled.mockReturnValue(false);
    const result = run();
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/app/account');
  });
});
