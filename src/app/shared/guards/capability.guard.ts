import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CapabilityService } from '../services/capability.service';

/**
 * Route guard that allows activation only when ALL of the given capability codes are enabled in the current
 * capability snapshot. Mirrors {@link roleGuard}; redirects to the dashboard otherwise. Used to keep the
 * dark accounting suite (CAP-ACCT-FULLGL / CAP-RPT-FINANCIALS) unreachable by URL until it is switched on.
 */
export function capabilityGuard(...requiredCapabilities: string[]): CanActivateFn {
  return () => {
    const capabilities = inject(CapabilityService);
    const router = inject(Router);

    if (requiredCapabilities.every((code) => capabilities.isEnabled(code))) {
      return true;
    }

    return router.createUrlTree(['/dashboard']);
  };
}
