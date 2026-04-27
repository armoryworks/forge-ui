import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, FormGroup } from '@angular/forms';

/**
 * Shape of a single validation error returned by the server's
 * `CustomInvalidModelStateResponseFactory` (Phase 3 / WU-02). The server emits
 * this exact key set on 400 model-binding rejections:
 *   { errors: [ { field, message, rejectedValue }, ... ] }
 *
 * `rejectedValue` is the raw attempted-value string the binder saw — useful for
 * debug surfaces (e.g. dev-tools panel) but not normally rendered to end users.
 */
export interface ServerValidationError {
  field: string;
  message: string;
  rejectedValue?: string | null;
}

/**
 * Server validation envelope as written by `CustomInvalidModelStateResponseFactory`.
 */
export interface ServerValidationEnvelope {
  errors: ServerValidationError[];
}

/**
 * Detect whether an `HttpErrorResponse` body matches the server's standardized
 * validation envelope. Returns the parsed `errors[]` array on match, or `null`
 * for legacy / unknown error shapes (so callers can fall back to generic
 * handling). Only the *shape* is checked — it does NOT require status === 400
 * because some endpoints surface the same envelope on 422.
 */
export function parseServerValidationEnvelope(
  error: HttpErrorResponse | unknown,
): ServerValidationError[] | null {
  if (!error || typeof error !== 'object') return null;
  const body = (error as { error?: unknown }).error;
  if (!body || typeof body !== 'object') return null;

  const errors = (body as { errors?: unknown }).errors;
  if (!Array.isArray(errors) || errors.length === 0) return null;

  // Each entry must minimally carry a `field` and `message` string.
  const parsed: ServerValidationError[] = [];
  for (const e of errors) {
    if (!e || typeof e !== 'object') return null;
    const field = (e as { field?: unknown }).field;
    const message = (e as { message?: unknown }).message;
    if (typeof field !== 'string' || typeof message !== 'string') return null;
    const rv = (e as { rejectedValue?: unknown }).rejectedValue;
    parsed.push({
      field,
      message,
      rejectedValue: typeof rv === 'string' ? rv : (rv == null ? null : String(rv)),
    });
  }
  return parsed;
}

/**
 * Resolve a dotted `field` path produced by the server (e.g. `address.line1`,
 * `lineItems[0].quantity`) to the matching `AbstractControl`, or `null` when no
 * matching control exists. Falls back to a case-insensitive lookup on the
 * top-level form so that `Field` from PascalCase server output hits the
 * camelCase reactive control.
 */
export function resolveFormControl(
  form: FormGroup,
  field: string,
): AbstractControl | null {
  if (!field) return null;

  // First try the exact path (handles dotted nested paths via FormGroup.get).
  const direct = form.get(field);
  if (direct) return direct;

  // Strip array indexers — `lineItems[0].quantity` -> `lineItems.0.quantity`
  const normalized = field.replace(/\[(\d+)\]/g, '.$1');
  if (normalized !== field) {
    const viaArray = form.get(normalized);
    if (viaArray) return viaArray;
  }

  // Case-insensitive match on top-level controls (server may emit PascalCase
  // even after the factory's camelCase fix-up — defensive).
  const lower = field.toLowerCase();
  for (const [key, control] of Object.entries(form.controls)) {
    if (key.toLowerCase() === lower) return control;
  }

  return null;
}

/**
 * Apply a parsed server validation envelope to a reactive `FormGroup`. Each
 * error is attached to the matching control via `setErrors({ serverError: { message } })`,
 * so existing per-form violation pipelines (`FormValidationService.collectViolations`
 * already surfaces any error object carrying a `message` field) light up
 * without any per-form glue.
 *
 * Returns the list of errors that did NOT match a control on the form — the
 * caller can surface those as a generic toast / form-level message so the user
 * is not silently misled.
 */
export function applyServerErrorsToForm(
  form: FormGroup,
  errors: ServerValidationError[],
): ServerValidationError[] {
  const unmatched: ServerValidationError[] = [];
  for (const err of errors) {
    const control = resolveFormControl(form, err.field);
    if (!control) {
      unmatched.push(err);
      continue;
    }
    // Preserve any pre-existing client-side errors so we don't accidentally
    // mark a control valid by overwriting `required` / `email` / etc.
    const existing = control.errors ?? {};
    control.setErrors({
      ...existing,
      serverError: {
        message: err.message,
        rejectedValue: err.rejectedValue,
      },
    });
    // Mark touched so downstream UIs that key off touched + invalid surface.
    control.markAsTouched();
  }
  // Force validity recomputation at the form level so `form.invalid` is true.
  form.updateValueAndValidity({ emitEvent: false });
  return unmatched;
}

/**
 * Clear any `serverError` previously written by `applyServerErrorsToForm` from
 * every control on the form, leaving framework / sync errors intact. Call this
 * before re-submitting a form so stale server messages don't linger.
 */
export function clearServerErrorsOnForm(form: FormGroup): void {
  for (const control of Object.values(form.controls)) {
    const errs = control.errors;
    if (!errs || !('serverError' in errs)) continue;
    const { serverError: _drop, ...rest } = errs;
    control.setErrors(Object.keys(rest).length > 0 ? rest : null);
  }
  form.updateValueAndValidity({ emitEvent: false });
}
