import { FormGroup, AbstractControl } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Signal, signal } from '@angular/core';
import { startWith } from 'rxjs';

import {
  applyServerErrorsToForm,
  clearServerErrorsOnForm,
  parseServerValidationEnvelope,
  ServerValidationError,
} from '../utils/server-validation.utils';

const ERROR_MESSAGES: Record<string, (label: string, error: unknown) => string> = {
  required: (label) => `${label} is required`,
  email: (label) => `${label} must be a valid email`,
  minlength: (label, err) => {
    const e = err as { requiredLength: number };
    return `${label} must be at least ${e.requiredLength} characters`;
  },
  maxlength: (label, err) => {
    const e = err as { requiredLength: number };
    return `${label} must be at most ${e.requiredLength} characters`;
  },
  min: (label, err) => {
    const e = err as { min: number };
    return `${label} must be at least ${e.min}`;
  },
  max: (label, err) => {
    const e = err as { max: number };
    return `${label} must be at most ${e.max}`;
  },
  pattern: (label) => `${label} format is invalid`,
};

export class FormValidationService {
  /**
   * Returns a signal of violation messages for the given form.
   * Safe to call from any context (constructor, effect, computed, etc.)
   * because it uses a plain subscription instead of toSignal().
   */
  static getViolations(
    form: FormGroup,
    labels: Record<string, string>,
  ): Signal<string[]> {
    const violations = signal<string[]>([]);

    form.statusChanges.pipe(startWith(form.status)).subscribe(() => {
      violations.set(FormValidationService.collectViolations(form, labels));
    });

    return violations.asReadonly();
  }

  static collectViolations(form: FormGroup, labels: Record<string, string>): string[] {
    const violations: string[] = [];

    for (const [key, control] of Object.entries(form.controls)) {
      const errors = (control as AbstractControl).errors;
      if (!errors) continue;

      const label = labels[key] ?? key;

      for (const [errorKey, errorValue] of Object.entries(errors)) {
        if (errorValue && typeof errorValue === 'object' && 'message' in errorValue) {
          // Server-side errors and any other rich error envelope use this path.
          // Prefix the label so a "Date is not valid" message reads as
          // "Start Date: Date is not valid" — the field is otherwise
          // unidentifiable in a popover that lists violations across the
          // whole form.
          const message = (errorValue as { message: unknown }).message;
          if (typeof message === 'string') {
            violations.push(errorKey === 'serverError' ? `${label}: ${message}` : message);
          }
        } else if (ERROR_MESSAGES[errorKey]) {
          violations.push(ERROR_MESSAGES[errorKey](label, errorValue));
        } else {
          violations.push(`${label} is invalid`);
        }
      }
    }

    return violations;
  }

  /**
   * Phase 3 / WU-02 retrofit. Apply the server's standardized validation
   * envelope to a reactive form so per-field error messages render against
   * the right inputs. Returns the unmatched errors (for the caller to
   * surface as a generic toast / form-level message). Returns `null` when
   * the response body did not match the envelope shape — the caller should
   * fall back to its legacy error path.
   */
  static applyServerError(
    form: FormGroup,
    error: HttpErrorResponse | unknown,
  ): { matched: ServerValidationError[]; unmatched: ServerValidationError[] } | null {
    const errors = parseServerValidationEnvelope(error);
    if (errors === null) return null;
    // Drop any prior server messages first so re-submits don't accumulate.
    clearServerErrorsOnForm(form);
    const unmatched = applyServerErrorsToForm(form, errors);
    const matched = errors.filter(e => !unmatched.includes(e));
    return { matched, unmatched };
  }

  /** Clear any `serverError` previously written by `applyServerError`. */
  static clearServerErrors(form: FormGroup): void {
    clearServerErrorsOnForm(form);
  }
}
