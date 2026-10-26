import { HttpContext, HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, retry, throwError, timer } from 'rxjs';

import { TranslateService } from '@ngx-translate/core';

import { CapabilityDisabledError } from '../errors/capability-disabled.error';
import { LayoutService } from '../services/layout.service';
import { SnackbarService } from '../services/snackbar.service';
import { ToastService } from '../services/toast.service';
import { localizeServerError } from '../utils/server-error-localizer';
import { ServerValidationError, parseServerValidationEnvelope } from '../utils/server-validation.utils';
import { markHttpErrorShown } from '../utils/shown-http-errors';
import { formatDate, parseDateOnly } from '../utils/date.utils';
import { SILENT_HTTP_ERRORS } from './silent-http-errors.token';

export const SUPPRESS_VALIDATION_SNACKBAR = new HttpContextToken<boolean>(() => false);

export const MFA_ENROLLMENT_REQUIRED = 'mfa-enrollment-required';

const NETWORK_RETRY_DELAYS_MS = [500, 1500];

const BARE_PROBLEM_KEYS = new Set(['type', 'title', 'status', 'detail', 'traceId', 'instance']);

export function formValidationContext(): HttpContext {
  return new HttpContext().set(SUPPRESS_VALIDATION_SNACKBAR, true);
}

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const snackbar = inject(SnackbarService);
  const toast = inject(ToastService);
  const translate = inject(TranslateService);
  const router = inject(Router);
  const injector = inject(Injector);

  const isExternal = /^https?:\/\//i.test(req.url) && !req.url.startsWith(window.location.origin);

  const idempotent = req.method === 'GET' || req.method === 'HEAD';

  return next(req).pipe(
    retry({
      count: NETWORK_RETRY_DELAYS_MS.length,
      delay: (error: unknown, attempt: number) =>
        idempotent && error instanceof HttpErrorResponse && error.status === 0
          ? timer(NETWORK_RETRY_DELAYS_MS[attempt - 1])
          : throwError(() => error),
    }),
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
          const message = localizedFieldErrors(fieldErrors, translate)
            ?? problemDetail(error) ?? fieldErrors?.[0].message ?? extractMessage(error);
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
          if (isMfaEnrollmentRequired(error)) {
            void router.navigate([injector.get(LayoutService).getMfaEnrollmentRoute()]);
            markHttpErrorShown(error);
            break;
          }
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
            message: currencyLockMessage(error, translate) ?? extractMessage(error) ?? translate.instant('errors.resourceModified'),
          });
          markHttpErrorShown(error);
          break;

        case 422: {
          // Validation error — typically handled by the calling service.
          // The same envelope shape (Phase 3 / WU-02) may also appear here
          // when controllers explicitly emit 422 — leave to the caller.
          const missingRate = fxRateMissingMessage(error, translate);
          if (missingRate) {
            snackbar.error(missingRate);
            markHttpErrorShown(error);
          }
          break;
        }

        case 0:
          if (document.visibilityState === 'hidden' || !navigator.onLine) break;
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

/**
 * The field errors worded in the UI language, joined like the server's own detail,
 * when the language is not English and at least one error carries a code the catalog
 * words. Null otherwise, so the server's text is shown.
 */
function localizedFieldErrors(errors: ServerValidationError[] | null, translate: TranslateService): string | null {
  if (!errors || (translate.getCurrentLang?.() ?? 'en') === 'en') return null;
  const messages = errors.map(e => localizeServerError(e, (key, params) => translate.instant(key, params)));
  if (messages.every((m, i) => m === errors[i].message)) return null;
  return [...new Set(messages)].join(' ');
}

function problemDetail(error: HttpErrorResponse): string | null {
  const body = error.error;
  return body && typeof body === 'object' && typeof body.detail === 'string' && body.detail
    ? body.detail
    : null;
}

function isMfaEnrollmentRequired(error: HttpErrorResponse): boolean {
  const body = error.error;
  return !!body && typeof body === 'object' && body.code === MFA_ENROLLMENT_REQUIRED;
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
  if (!body || typeof body !== 'object') return undefined;

  if (Object.keys(body).some(key => !BARE_PROBLEM_KEYS.has(key))) {
    try {
      return JSON.stringify(body, null, 2);
    } catch {
      return undefined;
    }
  }

  const lines: string[] = [];
  if (typeof body.detail === 'string' && body.detail) lines.push(body.detail);
  if (typeof body.traceId === 'string' && body.traceId) lines.push(`traceId: ${body.traceId}`);
  return lines.length > 0 ? lines.join('\n') : undefined;
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

const CURRENCY_LOCK_KEYS: Record<string, string> = {
  'party-currency-locked': 'apiErrors.codes.partyCurrencyLocked',
  'document-currency-locked': 'apiErrors.codes.documentCurrencyLocked',
  'base-currency-locked': 'apiErrors.codes.baseCurrencyLocked',
};

/** The worded message for a currency-lock conflict (409 with a currency lock code), else null. */
function currencyLockMessage(error: HttpErrorResponse, translate: TranslateService): string | null {
  const body = error.error;
  const code = body && typeof body === 'object' && typeof body.code === 'string' ? body.code : null;
  const key = code ? CURRENCY_LOCK_KEYS[code] : undefined;
  return key ? translate.instant(key) : null;
}

/** The worded message for 422 `fx-rate-missing`, naming the pair and date, else null. */
function fxRateMissingMessage(error: HttpErrorResponse, translate: TranslateService): string | null {
  const body = error.error;
  if (!body || typeof body !== 'object' || body.code !== 'fx-rate-missing') return null;
  const day = typeof body.date === 'string' ? parseDateOnly(body.date) : null;
  return translate.instant('apiErrors.codes.fxRateMissing', {
    from: body.fromCurrency ?? '',
    to: body.toCurrency ?? '',
    date: day ? formatDate(day) : (body.date ?? ''),
  });
}
