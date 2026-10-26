import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RedirectCommand, RouterStateSnapshot, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { CapabilityService } from '../services/capability.service';
import { anyCapabilityGuard } from './any-capability.guard';

function run(enabled: string[]): unknown {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: CapabilityService,
        useValue: { descriptor: () => ({}), isEnabled: (code: string) => enabled.includes(code), load: () => of(null) },
      },
    ],
  });
  return TestBed.runInInjectionContext(() =>
    anyCapabilityGuard('CAP-ACCT-MIGRATION', 'CAP-ACCT-FULLGL')(
      {} as ActivatedRouteSnapshot, { url: '/accounting/opening-stock' } as RouterStateSnapshot));
}

describe('anyCapabilityGuard', () => {
  it('lets the route open when any one of the capabilities is on', () => {
    expect(run(['CAP-ACCT-FULLGL'])).toBe(true);
  });

  it('shows the feature-off page when none is on', () => {
    expect(run([])).toBeInstanceOf(RedirectCommand);
  });
});
