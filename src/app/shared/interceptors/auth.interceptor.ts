import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

const OWN_API_PATTERN = /^(\/api\/|https?:\/\/localhost)/;

/** URLs that should never trigger a refresh attempt. */
const NO_REFRESH_URLS = ['/auth/login', '/auth/refresh', '/auth/logout', '/auth/setup', '/auth/complete-setup'];

let isRefreshing = false;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.token();
  const isOwnApi = OWN_API_PATTERN.test(req.url);

  const authReq = token && isOwnApi
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && isOwnApi && authService.isAuthenticated()) {
        // Don't attempt refresh for auth endpoints themselves
        if (NO_REFRESH_URLS.some(url => req.url.includes(url))) {
          authService.clearAuth();
          router.navigate(['/login'], { queryParams: { reason: 'session_expired' } });
          return throwError(() => error);
        }

        // Prevent concurrent refresh attempts
        if (isRefreshing) {
          authService.clearAuth();
          router.navigate(['/login'], { queryParams: { reason: 'session_expired' } });
          return throwError(() => error);
        }

        isRefreshing = true;
        return authService.refreshAccessToken().pipe(
          switchMap((newToken) => {
            isRefreshing = false;
            if (newToken) {
              // Retry the original request with the new token
              const retryReq = req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } });
              return next(retryReq);
            }
            // Refresh failed — session is gone
            authService.clearAuth();
            router.navigate(['/login'], { queryParams: { reason: 'session_expired' } });
            return throwError(() => error);
          }),
          catchError((refreshError) => {
            isRefreshing = false;
            authService.clearAuth();
            router.navigate(['/login'], { queryParams: { reason: 'session_expired' } });
            return throwError(() => refreshError);
          }),
        );
      }
      return throwError(() => error);
    }),
  );
};
