import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';
import { LayoutService } from '../services/layout.service';
import { MobileAuthService } from '../services/mobile-auth.service';

const OWN_API_PATTERN = /^(\/api\/|https?:\/\/localhost)/;

/** URLs that should never trigger a refresh attempt. */
const NO_REFRESH_URLS = ['/auth/login', '/auth/refresh', '/auth/logout', '/auth/setup', '/auth/complete-setup', '/devices/enroll', '/devices/refresh'];

let isRefreshing = false;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const mobileAuth = inject(MobileAuthService);
  const router = inject(Router);
  const layout = inject(LayoutService);
  const token = authService.token();
  const isOwnApi = OWN_API_PATTERN.test(req.url);
  // Phase 1q — never attach the employee token to /portal/* requests.
  // Customer-portal calls carry their own session JWT (handled by
  // portalAuthInterceptor) and the two token namespaces must not mix.
  const isPortalCall = req.url.includes('/portal/');

  const authReq = token && isOwnApi && !isPortalCall
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  /** Redirect to login preserving the current route as returnUrl.
   *  Open MatDialog overlays are closed inside AuthService.clearAuth()
   *  — the universal chokepoint for auth loss, so every path (cross-tab
   *  broadcast, SignalR auth failure, explicit logout, kiosk reset)
   *  also gets the cleanup. Don't duplicate that here. */
  const redirectToLogin = () => {
    authService.clearAuth();
    if (environment.mobileShell) {
      // The shell has no /login — a dead session goes back to enrollment.
      router.navigate(['/app/enroll'], { queryParams: { reason: 'session_expired' } });
      return;
    }
    const currentUrl = router.url;
    const queryParams: Record<string, string> = { reason: 'session_expired' };
    // Preserve current route so user returns here after re-login
    if (currentUrl && currentUrl !== '/' && !layout.isAuthRoute()) {
      queryParams['returnUrl'] = currentUrl;
    }
    router.navigate(['/login'], { queryParams });
  };

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && isOwnApi && authService.isAuthenticated()) {
        // Don't attempt refresh for auth endpoints themselves
        if (NO_REFRESH_URLS.some(url => req.url.includes(url))) {
          redirectToLogin();
          return throwError(() => error);
        }

        // Prevent concurrent refresh attempts
        if (isRefreshing) {
          redirectToLogin();
          return throwError(() => error);
        }

        isRefreshing = true;
        // Native shell sessions refresh with the device-bound rotating
        // token; web sessions with the JTI-rotation endpoint.
        const refresh$ = environment.mobileShell
          ? mobileAuth.refreshAccessToken()
          : authService.refreshAccessToken();
        return refresh$.pipe(
          switchMap((newToken) => {
            isRefreshing = false;
            if (newToken) {
              // Retry the original request with the new token
              const retryReq = req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } });
              return next(retryReq);
            }
            // Refresh failed — session is gone
            redirectToLogin();
            return throwError(() => error);
          }),
          catchError((refreshError) => {
            isRefreshing = false;
            redirectToLogin();
            return throwError(() => refreshError);
          }),
        );
      }
      return throwError(() => error);
    }),
  );
};
