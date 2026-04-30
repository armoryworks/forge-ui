import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { TranslateService } from '@ngx-translate/core';

import { CapabilityDisabledError } from '../errors/capability-disabled.error';
import { SnackbarService } from '../services/snackbar.service';
import { ToastService } from '../services/toast.service';
import { parseServerValidationEnvelope } from '../utils/server-validation.utils';

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
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

        case 403: {
          // Phase 4 Phase-D — capability-gate resilience.
          //
          // The server's `CapabilityGateMiddleware` short-circuits gated
          // endpoints whose capability is disabled with HTTP 403 + envelope
          //   { errors: [ { code: "capability-disabled", capability, message } ] }
          // and the `X-Capability-Disabled` response header.
          //
          // A disabled capability is an intentional configuration state, not
          // a security violation. Suppress the access-denied snackbar AND
          // raise a typed `CapabilityDisabledError` so callers can degrade
          // their UI silently (hide AI button, render no announcement card,
          // etc.). Callers that don't catch see no visible UI side-effect —
          // the Observable simply errors with the tagged error, which the
          // toast/snackbar layers explicitly ignore.
          const cap = parseCapabilityDisabled(error);
          if (cap) {
            // Diagnostic visibility without flagging as an error in devtools.
            console.debug(`[capability-disabled] ${cap.capability}: ${cap.message}`);
            return throwError(() => new CapabilityDisabledError(cap.capability, cap.message));
          }
          snackbar.error(translate.instant('errors.accessDenied'));
          break;
        }

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

/**
 * Detect the capability-gate envelope on a 403 response. Checks both the
 * envelope `errors[0].code === 'capability-disabled'` shape (authoritative —
 * it carries the capability id and message) and the `X-Capability-Disabled`
 * response header (defensive — server middleware sets it but consumers may
 * not have access to the envelope shape if a proxy strips bodies).
 *
 * Returns the parsed `{ capability, message }` on match, or `null` when the
 * 403 is a plain access-denied response.
 */
function parseCapabilityDisabled(
  error: HttpErrorResponse,
): { capability: string; message: string } | null {
  const body = error.error as unknown;
  if (body && typeof body === 'object') {
    const errors = (body as { errors?: unknown }).errors;
    if (Array.isArray(errors) && errors.length > 0) {
      const first = errors[0];
      if (first && typeof first === 'object'
        && (first as { code?: unknown }).code === 'capability-disabled') {
        const capability = String((first as { capability?: unknown }).capability ?? '');
        const message = String((first as { message?: unknown }).message
          ?? 'This capability is disabled for this installation.');
        if (capability) {
          return { capability, message };
        }
      }
    }
  }

  // Header-based fallback. The server middleware always sets it alongside
  // the envelope; checking it lets us survive a body that's been mangled
  // by a proxy / mocked transport that drops JSON bodies on 403.
  const header = error.headers?.get('X-Capability-Disabled');
  if (header) {
    return {
      capability: header,
      message: 'This capability is disabled for this installation.',
    };
  }

  return null;
}
