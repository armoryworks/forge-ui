import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { LayoutService } from '../services/layout.service';

/**
 * Redirects mobile devices to the `/m/` mobile UI.
 * Applied to desktop routes only — mobile routes don't use this guard.
 * Users can opt out by setting `preferDesktop` in sessionStorage
 * (e.g., via a "View Desktop Site" link in the mobile UI).
 */
export const mobileRedirectGuard: CanActivateFn = () => {
  const layout = inject(LayoutService);
  const router = inject(Router);

  if (layout.isMobileDevice() && sessionStorage.getItem('preferDesktop') !== 'true') {
    return router.createUrlTree(['/m']);
  }

  return true;
};
