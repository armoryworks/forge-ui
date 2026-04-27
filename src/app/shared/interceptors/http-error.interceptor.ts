import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { TranslateService } from '@ngx-translate/core';

import { SnackbarService } from '../services/snackbar.service';
import { ToastService } from '../services/toast.service';
import { parseServerValidationEnvelope } from '../utils/server-validation.utils';

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const snackbar = inject(SnackbarService);
  const toast = inject(ToastService);
  const translate = inject(TranslateService);

  const isExternal = /^https?:\/\//i.test(req.url) && !req.url.startsWith(window.location.origin);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (isExternal) {
        return throwError(() => error);
      }
      switch (error.status) {
        case 400: {
          // Phase 3 / WU-02 retrofit: server now returns
          //   { errors: [ { field, message, rejectedValue }, ... ] }
          // on model-binding rejection. The interceptor's job is only to NOT
          // surface a generic toast when callers will display per-field
          // errors against form controls — the calling component pulls the
          // envelope out of the error and applies it via
          // `applyServerErrorsToForm`.
          //
          // Legacy non-envelope 400 responses still get a snackbar fallback
          // so the user is not left guessing.
          if (parseServerValidationEnvelope(error) === null) {
            const message = extractMessage(error);
            if (message) {
              snackbar.error(message);
            }
          }
          break;
        }

        case 401:
          // Auth interceptor handles 401 → login redirect.
          // This is a fallback if auth interceptor doesn't catch it.
          break;

        case 403:
          snackbar.error(translate.instant('errors.accessDenied'));
          break;

        case 404:
          // Not found — typically handled by the calling service.
          break;

        case 409:
          // Business conflict — extract message from response body.
          toast.show({
            severity: 'warning',
            title: translate.instant('errors.conflict'),
            message: extractMessage(error) ?? translate.instant('errors.resourceModified'),
          });
          break;

        case 422:
          // Validation error — typically handled by the calling service.
          // The same envelope shape (Phase 3 / WU-02) may also appear here
          // when controllers explicitly emit 422 — leave to the caller.
          break;

        case 0:
          // Network error / connection lost.
          toast.show({
            severity: 'error',
            title: translate.instant('errors.connectionLost'),
            message: translate.instant('errors.unableToReachServer'),
          });
          break;

        default:
          if (error.status >= 500) {
            const message = extractMessage(error) ?? translate.instant('errors.unexpectedError');
            const details = extractDetails(error);
            toast.show({
              severity: 'error',
              title: translate.instant('errors.serverError', { status: error.status }),
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

  // Problem Details (RFC 7807) — prefer detail (specific) over title (generic)
  if (typeof body === 'object' && body.detail) return body.detail;
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
