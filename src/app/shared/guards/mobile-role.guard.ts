import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { InstanceService } from '../services/instance.service';
import { MOBILE_APP_SCREENS, screenOpenToViewer } from '../utils/mobile-app-screens';

/**
 * A role-limited phone screen (see {@link screenOpenToViewer}) is reachable by URL only when it is open to
 * whoever holds the device; anyone else lands on Account.
 */
export function mobileRoleGuard(path: string): CanActivateFn {
  return () => {
    const screen = MOBILE_APP_SCREENS.find((s) => s.path === path);
    if (!screen) return true;
    const sharedDevice = !!inject(InstanceService).instance()?.shared;
    return screenOpenToViewer(screen, inject(AuthService), sharedDevice) || inject(Router).parseUrl('/app/account');
  };
}
