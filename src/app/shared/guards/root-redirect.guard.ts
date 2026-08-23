import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { environment } from '../../../environments/environment';
import { LayoutService } from '../services/layout.service';

/**
 * Branches the root path based on build target. Demo builds land on the
 * marketing/welcome page; production builds resolve the role-aware default route
 * (mobile → `/m`, explicit user preference, single-role landing, else dashboard).
 */
export const rootRedirectGuard: CanActivateFn = () => {
  const router = inject(Router);
  if (environment.demoMode) return router.parseUrl('/welcome');
  return router.parseUrl(inject(LayoutService).getDefaultRoute());
};
