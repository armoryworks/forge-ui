import { inject } from '@angular/core';
import { CanActivateFn, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { LayoutService } from '../services/layout.service';

/** Desktop routes that work fine on mobile — don't redirect these. */
const MOBILE_EXEMPT_PREFIXES = ['/account', '/onboarding'];

/**
 * Redirects mobile devices to the `/m/` mobile UI.
 * Applied to desktop routes only — mobile routes don't use this guard.
 * A job deep link (`/jobs/:id`, `/kanban?detail=job:N`) opens that job in
 * `/m`; anything else lands on `/m` carrying the original URL as `returnUrl`.
 * Users can opt out by setting `preferDesktop` in localStorage
 * (e.g., via a "View Desktop Site" link in the mobile UI).
 */
export const mobileRedirectGuard: CanActivateFn = (_route, state: RouterStateSnapshot) => {
  const layout = inject(LayoutService);
  const router = inject(Router);

  if (layout.isMobileDevice() && !prefersDesktop()) {
    if (MOBILE_EXEMPT_PREFIXES.some(prefix => state.url.startsWith(prefix))) {
      return true;
    }
    return mobileTarget(router, state.url);
  }

  return true;
};

function mobileTarget(router: Router, url: string): UrlTree {
  const tree = router.parseUrl(url);
  const segments = tree.root.children['primary']?.segments.map(s => s.path) ?? [];

  if (segments.length === 2 && segments[0] === 'jobs' && /^\d+$/.test(segments[1])) {
    return router.createUrlTree(['/m/jobs', segments[1]]);
  }

  const detail = tree.queryParams['detail'];
  const jobDetail = typeof detail === 'string' ? /^job:(\d+)$/.exec(detail) : null;
  if (segments.length === 1 && segments[0] === 'kanban' && jobDetail) {
    return router.createUrlTree(['/m/jobs', jobDetail[1]]);
  }

  return router.createUrlTree(['/m'], { queryParams: { returnUrl: url } });
}

function prefersDesktop(): boolean {
  try {
    return localStorage.getItem('preferDesktop') === 'true';
  } catch {
    return false;
  }
}
