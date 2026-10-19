import { HttpErrorResponse, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { PortalService } from './portal.service';

/**
 * Attaches the portal session JWT to outbound /portal/* requests. The
 * employee `authInterceptor` doesn't pick these up because the portal
 * token lives under `portal-token` (not `forge-token`), so they don't
 * collide. Auth + exchange endpoints are anonymous and skipped. A
 * /portal/me request with no live token, or one the API answers with 401,
 * ends the portal session and sends the customer back to sign in.
 */
export const portalAuthInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  if (!req.url.includes('/portal/')) {
    return next(req);
  }
  if (req.url.includes('/portal/auth/')) {
    return next(req);
  }

  const portal = inject(PortalService);
  const token = portal.getToken();
  const sessionRequest = req.url.includes('/portal/me');
  if (!token) {
    if (sessionRequest) portal.endSession();
    return next(req);
  }

  return next(req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  })).pipe(
    catchError((err: unknown) => {
      if (sessionRequest && err instanceof HttpErrorResponse && err.status === 401) {
        portal.endSession();
      }
      return throwError(() => err);
    }),
  );
};
