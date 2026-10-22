import { FormGroup, ValidationErrors } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Signal, signal } from '@angular/core';
import { startWith } from 'rxjs';

import {
  applyServerErrorsToForm,
  clearServerErrorsOnForm,
  parseServerValidationEnvelope,
  ServerValidationError,
} from '../utils/server-validation.utils';
import { localizeServerError } from '../utils/server-error-localizer';

/**
 * Violation pair carrying both the human-readable message AND the
 * source control name so the validation popover can render a
 * click-to-jump that focuses the offending field. The legacy
 * string[] shape stays on getViolations / collectViolations for
 * backward compat with the 50+ existing consumers; this richer
 * shape is opt-in via getViolationItems / collectViolationItems.
 */
export interface ViolationItem {
  controlName: string;
  message: string;
}

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
  positive: (label) => `${label} must be greater than 0`,
  wholeNumber: (label) => `${label} must be a whole number`,
};

type MessageTranslator = (key: string, params: Record<string, unknown>) => string;

const ERROR_MESSAGE_KEYS: Record<string, (label: string, error: unknown) => [string, Record<string, unknown>]> = {
  required: (label) => ['validation.messages.required', { label }],
  email: (label) => ['validation.messages.email', { label }],
  minlength: (label, err) => ['validation.messages.minLength', { label, count: (err as { requiredLength: number }).requiredLength }],
  maxlength: (label, err) => ['validation.messages.maxLength', { label, count: (err as { requiredLength: number }).requiredLength }],
  min: (label, err) => ['validation.messages.min', { label, min: (err as { min: number }).min }],
  max: (label, err) => ['validation.messages.max', { label, max: (err as { max: number }).max }],
  pattern: (label) => ['validation.messages.pattern', { label }],
  positive: (label) => ['validation.messages.positive', { label }],
  wholeNumber: (label) => ['validation.messages.wholeNumber', { label }],
};

let translator: MessageTranslator | null = null;
let currentLanguage: () => string = () => 'en';

export class FormValidationService {
  /**
   * Routes the built-in validation messages through the UI translations.
   * Set once at startup; until then (and in unit tests) messages are English.
   * `language` reports the UI language so coded server errors are worded in it
   * whenever it is not English (English keeps the server's own wording).
   */
  static setTranslator(fn: MessageTranslator | null, language: () => string = () => 'en'): void {
    translator = fn;
    currentLanguage = language;
  }

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
    return FormValidationService.collectViolationItems(form, labels).map(v => v.message);
  }

  /**
   * Same scan as collectViolations but returns each violation alongside
   * the control name that produced it. Powers the validation popover's
   * click-to-jump so a click on a violation can scroll/focus the source
   * field instead of leaving the user hunting. Group-level (cross-field)
   * errors carrying a `message` are included too, jumping to their
   * optional `field` (empty controlName when none is given).
   */
  static collectViolationItems(form: FormGroup, labels: Record<string, string>): ViolationItem[] {
    const items: ViolationItem[] = [];

    FormValidationService.collectGroup(items, form, '', labels);

    for (const errorValue of Object.values(form.errors ?? {})) {
      const { message, field } = (errorValue ?? {}) as { message?: unknown; field?: unknown };
      if (typeof message !== 'string') continue;
      items.push({ controlName: typeof field === 'string' ? field : '', message });
    }

    return items;
  }

  /**
   * Readable fallback label for a control with no entry in the labels map
   * ("unitPrice" -> "Unit price").
   */
  static labelFromControlName(controlName: string): string {
    const words = controlName
      .replace(/[_-]+/g, ' ')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .trim()
      .toLowerCase();
    return words ? words.charAt(0).toUpperCase() + words.slice(1) : controlName;
  }

  private static collectGroup(
    items: ViolationItem[],
    group: FormGroup,
    prefix: string,
    labels: Record<string, string>,
  ): void {
    for (const [key, control] of Object.entries(group.controls)) {
      const path = prefix ? `${prefix}.${key}` : key;
      const label = labels[path] ?? labels[key] ?? FormValidationService.labelFromControlName(key);
      if (control.errors) {
        FormValidationService.pushMessages(items, path, control.errors, label);
      }
      if (control instanceof FormGroup) {
        FormValidationService.collectGroup(items, control, path, labels);
      }
    }
  }

  private static pushMessages(
    items: ViolationItem[],
    controlName: string,
    errors: ValidationErrors,
    label: string,
  ): void {
    for (const [errorKey, errorValue] of Object.entries(errors)) {
      const message = FormValidationService.messageFor(errorKey, errorValue, label);
      if (message !== null) {
        items.push({ controlName, message });
      }
    }
  }

  /**
   * Message text for a single validation error on a field labelled `label`.
   * Shared by the violation summary and the per-field error lines on
   * app-input and app-autocomplete so all read the same. Returns null for an
   * error object whose `message` is not a string. An error carrying a
   * `messageKey` is translated here, each time it is shown, so the current
   * language applies.
   */
  static messageFor(errorKey: string, errorValue: unknown, label: string): string | null {
    if (errorValue && typeof errorValue === 'object' && 'messageKey' in errorValue) {
      const messageKey = (errorValue as { messageKey: unknown }).messageKey;
      if (typeof messageKey !== 'string') return null;
      return translator ? translator(messageKey, { label }) : messageKey;
    }
    if (errorValue && typeof errorValue === 'object' && 'message' in errorValue) {
      const message = (errorValue as { message: unknown }).message;
      if (typeof message !== 'string') return null;
      if (errorKey !== 'serverError' || message.toLowerCase().startsWith(label.toLowerCase())) return message;
      return `${label}: ${message}`;
    }
    if (translator) {
      const [key, params] = ERROR_MESSAGE_KEYS[errorKey]?.(label, errorValue) ?? ['validation.messages.invalid', { label }];
      return translator(key, params);
    }
    if (ERROR_MESSAGES[errorKey]) {
      return ERROR_MESSAGES[errorKey](label, errorValue);
    }
    return `${label} is invalid`;
  }

  /**
   * Item-aware sibling of getViolations(). Returns a Signal of
   * ViolationItem so consumers wiring click-to-jump can subscribe to a
   * structured stream instead of stringly-typed messages.
   */
  static getViolationItems(
    form: FormGroup,
    labels: Record<string, string>,
  ): Signal<ViolationItem[]> {
    const items = signal<ViolationItem[]>([]);

    form.statusChanges.pipe(startWith(form.status)).subscribe(() => {
      items.set(FormValidationService.collectViolationItems(form, labels));
    });

    return items.asReadonly();
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
    const parsed = parseServerValidationEnvelope(error);
    if (parsed === null) return null;
    const localize = translator;
    const errors = localize && currentLanguage() !== 'en'
      ? parsed.map(e => ({ ...e, message: localizeServerError(e, (key, params) => localize(key, params ?? {})) }))
      : parsed;
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
