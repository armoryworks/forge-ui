import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { environment } from '../../../environments/environment';

/**
 * Branches the root path based on build target. Demo builds land on the
 * marketing/welcome page; production builds go straight to the dashboard
 * (identical behavior to the original `redirectTo: 'dashboard'`).
 */
export const rootRedirectGuard: CanActivateFn = () => {
  const router = inject(Router);
  return router.parseUrl(environment.demoMode ? '/welcome' : '/dashboard');
};
