import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { CapabilityService } from '../services/capability.service';
import { MOBILE_APP_SCREENS } from '../utils/mobile-app-screens';

/**
 * A screen whose CAP-MOBILE-* flag is off is unreachable by URL: the person
 * lands on the first screen that is on, or on Account (always there, and it
 * explains why) when none is. Unknown snapshot fails open — the server
 * still answers 403.
 */
export function mobileScreenGuard(capability: string): CanActivateFn {
  return () => {
    const capabilities = inject(CapabilityService);
    if (capabilities.isEnabled(capability, true)) return true;
    const fallback = MOBILE_APP_SCREENS.find((screen) => capabilities.isEnabled(screen.capability, true));
    return inject(Router).parseUrl(fallback?.path ?? '/app/account');
  };
}
