import { HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';

import { PortalService } from './portal.service';

/**
 * Attaches the portal session JWT to outbound /portal/* requests. The
 * employee `authInterceptor` doesn't pick these up because the portal
 * token lives under `portal-token` (not `forge-token`), so they don't
 * collide. Auth + exchange endpoints are anonymous and skipped.
 */
export const portalAuthInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  if (!req.url.includes('/portal/')) {
    return next(req);
  }
  if (req.url.includes('/portal/auth/')) {
    return next(req);
  }

  const token = inject(PortalService).getToken();
  if (!token) {
    return next(req);
  }

  return next(req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  }));
};
