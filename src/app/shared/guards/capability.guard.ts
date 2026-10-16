import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';

import { CapabilityService } from '../services/capability.service';

/**
 * Route guard that allows activation only when ALL of the given capability codes are enabled in the current
 * capability snapshot. Mirrors {@link roleGuard}; redirects to the dashboard otherwise. Used to keep the
 * dark accounting suite (CAP-ACCT-FULLGL / CAP-RPT-FINANCIALS) unreachable by URL until it is switched on.
 * On a deep link that lands before the descriptor has loaded, it waits for the load rather than answering
 * from an empty snapshot.
 */
export function capabilityGuard(...requiredCapabilities: string[]): CanActivateFn {
  return () => {
    const capabilities = inject(CapabilityService);
    const router = inject(Router);

    const decide = () => requiredCapabilities.every((code) => capabilities.isEnabled(code))
      ? true
      : router.createUrlTree(['/dashboard']);

    if (capabilities.descriptor() === null) {
      return capabilities.load().pipe(map(decide));
    }
    return decide();
  };
}
