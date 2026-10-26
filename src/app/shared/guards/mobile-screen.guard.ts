import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { CapabilityService } from '../services/capability.service';
import { InstanceService } from '../services/instance.service';
import { MOBILE_APP_SCREENS, screenOpenToViewer } from '../utils/mobile-app-screens';

/**
 * A screen whose flag is off is unreachable by URL: the person
 * lands on the first screen that is on (and open to their role), or on Account (always there, and it
 * explains why) when none is. Unknown snapshot fails open — the server
 * still answers 403.
 */
export function mobileScreenGuard(capability: string): CanActivateFn {
  return () => {
    const capabilities = inject(CapabilityService);
    if (capabilities.isEnabled(capability, true)) return true;
    const auth = inject(AuthService);
    const sharedDevice = !!inject(InstanceService).instance()?.shared;
    const fallback = MOBILE_APP_SCREENS.find((screen) => capabilities.isEnabled(screen.capability, true)
      && screenOpenToViewer(screen, auth, sharedDevice));
    return inject(Router).parseUrl(fallback?.path ?? '/app/account');
  };
}
