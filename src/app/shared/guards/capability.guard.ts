import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { map } from 'rxjs';
import { CapabilityService } from '../services/capability.service';

/**
 * Route guard that allows activation only when ALL of the given capability codes are enabled in the current
 * capability snapshot. Mirrors {@link roleGuard}; redirects to the dashboard otherwise. Used to keep the
 * dark accounting suite (CAP-ACCT-FULLGL / CAP-RPT-FINANCIALS) unreachable by URL until it is switched on.
 * On a cold deep link the live descriptor has not loaded yet, so the guard waits for it before deciding.
 */
export function capabilityGuard(...requiredCapabilities: string[]): CanActivateFn {
  return () => {
    const capabilities = inject(CapabilityService);
    const router = inject(Router);

    const decide = (): boolean | UrlTree =>
      requiredCapabilities.every((code) => capabilities.isEnabled(code))
        ? true
        : router.createUrlTree(['/dashboard']);

    if (capabilities.descriptor() !== null) {
      return decide();
    }

    return capabilities.load().pipe(map(decide));
  };
}
