import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

const OWN_API_PATTERN = /^(\/api\/|https?:\/\/localhost)/;

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
      if (error.status === 401 && isOwnApi) {
        // Only clear + navigate if still authenticated (prevents race from concurrent 401s)
        if (authService.isAuthenticated()) {
          authService.clearAuth();
          router.navigate(['/login']);
        }
      }
      return throwError(() => error);
    }),
  );
};
