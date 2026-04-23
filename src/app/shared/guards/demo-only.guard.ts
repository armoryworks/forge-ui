import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { environment } from '../../../environments/environment';

/**
 * Blocks routes that only make sense in the static demo build. In the
 * production build, redirects to the dashboard so a stray direct-link to
 * `/welcome` (or similar demo-only page) never renders marketing copy to a
 * real user.
 */
export const demoOnlyGuard: CanActivateFn = () => {
  if (environment.demoMode) return true;
  const router = inject(Router);
  return router.parseUrl('/dashboard');
};
