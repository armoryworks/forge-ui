import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { PortalService } from './portal.service';

export const portalAuthGuard: CanActivateFn = () => {
  const portal = inject(PortalService);
  const router = inject(Router);

  if (portal.isAuthenticated()) return true;
  router.navigate(['/portal/login']);
  return false;
};
