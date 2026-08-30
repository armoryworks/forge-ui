import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { CapabilityService } from '../services/capability.service';

/**
 * A screen whose CAP-MOBILE-* flag is off is unreachable by URL; the
 * Account screen is always there. Unknown snapshot fails open — the
 * server still answers 403.
 */
export function mobileScreenGuard(capability: string): CanActivateFn {
  return () => {
    const capabilities = inject(CapabilityService);
    return capabilities.isEnabled(capability, true) ? true : inject(Router).parseUrl('/app/account');
  };
}
