import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { PortalService } from './portal.service';

export const portalAuthGuard: CanActivateFn = () => {
  const portal = inject(PortalService);
  const router = inject(Router);

  if (portal.isAuthenticated()) return true;
  if (portal.hasLapsedSession()) {
    portal.logout();
    return router.createUrlTree(['/portal/login'], { queryParams: { reason: 'session_expired' } });
  }
  return router.createUrlTree(['/portal/login']);
};
