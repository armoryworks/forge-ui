import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { SnackbarService } from '../services/snackbar.service';
import { ToastService } from '../services/toast.service';

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const snackbar = inject(SnackbarService);
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      switch (error.status) {
        case 401:
          // Auth interceptor handles 401 → login redirect.
          // This is a fallback if auth interceptor doesn't catch it.
          break;

        case 403:
          snackbar.error('Access denied. You do not have permission for this action.');
          break;

        case 404:
          // Not found — typically handled by the calling service.
          break;

        case 409:
          // Business conflict — extract message from response body.
          toast.show({
            severity: 'warning',
            title: 'Conflict',
            message: extractMessage(error) ?? 'The resource was modified by another user.',
          });
          break;

        case 422:
          // Validation error — typically handled by the calling service.
          break;

        case 0:
          // Network error / connection lost.
          toast.show({
            severity: 'error',
            title: 'Connection Lost',
            message: 'Unable to reach the server. Check your network connection.',
          });
          break;

        default:
          if (error.status >= 500) {
            const message = extractMessage(error) ?? 'An unexpected error occurred.';
            const details = extractDetails(error);
            toast.show({
              severity: 'error',
              title: `Server Error (${error.status})`,
              message,
              details,
            });
          }
          break;
      }

      return throwError(() => error);
    }),
  );
};

function extractMessage(error: HttpErrorResponse): string | null {
  const body = error.error;
  if (!body) return null;

  // Problem Details (RFC 7807)
  if (typeof body === 'object' && body.title) return body.title;
  if (typeof body === 'object' && body.message) return body.message;
  if (typeof body === 'string') return body;

  return null;
}

function extractDetails(error: HttpErrorResponse): string | undefined {
  const body = error.error;
  if (!body) return undefined;

  // Problem Details detail field
  if (typeof body === 'object' && body.detail) return body.detail;

  // Stack trace or full error body for copy button
  try {
    return JSON.stringify(body, null, 2);
  } catch {
    return undefined;
  }
}
