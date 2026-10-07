import { HttpContext, HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { TranslateService } from '@ngx-translate/core';

import { CapabilityDisabledError } from '../errors/capability-disabled.error';
import { SnackbarService } from '../services/snackbar.service';
import { ToastService } from '../services/toast.service';
import { parseServerValidationEnvelope } from '../utils/server-validation.utils';
import { markHttpErrorShown } from '../utils/shown-http-errors';
import { SILENT_HTTP_ERRORS } from './silent-http-errors.token';

export const SUPPRESS_VALIDATION_SNACKBAR = new HttpContextToken<boolean>(() => false);

export function formValidationContext(): HttpContext {
  return new HttpContext().set(SUPPRESS_VALIDATION_SNACKBAR, true);
}

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const snackbar = inject(SnackbarService);
  const toast = inject(ToastService);
  const translate = inject(TranslateService);

  const isExternal = /^https?:\/\//i.test(req.url) && !req.url.startsWith(window.location.origin);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (isExternal || req.context.get(SILENT_HTTP_ERRORS)) {
        return throwError(() => error);
      }
      switch (error.status) {
        case 400: {
          const fieldErrors = parseServerValidationEnvelope(error);
          if (fieldErrors !== null && req.context.get(SUPPRESS_VALIDATION_SNACKBAR)) {
            break;
          }
          const message = problemDetail(error) ?? fieldErrors?.[0].message ?? extractMessage(error);
          if (message) {
            snackbar.error(message);
            markHttpErrorShown(error);
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
          markHttpErrorShown(error);
          break;
        }

        case 404:
          // Not found — typically handled by the calling service.
          break;

        case 409:
          // Business conflict — extract message from response body.
          toast.show({
            severity: 'warning',
            title: translate.instant(isBusinessRule(error) ? 'errors.ruleViolation' : 'errors.conflict'),
            message: extractMessage(error) ?? translate.instant('errors.resourceModified'),
          });
          markHttpErrorShown(error);
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
          markHttpErrorShown(error);
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
            markHttpErrorShown(error);
          }
          break;
      }

      return throwError(() => error);
    }),
  );
};

function problemDetail(error: HttpErrorResponse): string | null {
  const body = error.error;
  return body && typeof body === 'object' && typeof body.detail === 'string' && body.detail
    ? body.detail
    : null;
}

function isBusinessRule(error: HttpErrorResponse): boolean {
  const body = error.error;
  return !!body && typeof body === 'object' && body.code === 'business-rule';
}

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
