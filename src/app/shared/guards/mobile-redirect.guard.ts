import { inject } from '@angular/core';
import { CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';
import { LayoutService } from '../services/layout.service';

/** Desktop routes that work fine on mobile — don't redirect these. */
const MOBILE_EXEMPT_PREFIXES = ['/account', '/onboarding'];

/**
 * Redirects mobile devices to the `/m/` mobile UI.
 * Applied to desktop routes only — mobile routes don't use this guard.
 * Users can opt out by setting `preferDesktop` in sessionStorage
 * (e.g., via a "View Desktop Site" link in the mobile UI).
 */
export const mobileRedirectGuard: CanActivateFn = (_route, state: RouterStateSnapshot) => {
  const layout = inject(LayoutService);
  const router = inject(Router);

  const isMobile = layout.isMobileDevice();
  const preferDesktop = sessionStorage.getItem('preferDesktop');

  if (isMobile && preferDesktop !== 'true') {
    // Allow certain desktop routes that work on mobile
    if (MOBILE_EXEMPT_PREFIXES.some(prefix => state.url.startsWith(prefix))) {
      return true;
    }
    return router.createUrlTree(['/m']);
  }

  return true;
};
