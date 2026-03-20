import { FormGroup, AbstractControl } from '@angular/forms';
import { Signal, signal } from '@angular/core';
import { startWith } from 'rxjs';

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
          violations.push(errorValue.message as string);
        } else if (ERROR_MESSAGES[errorKey]) {
          violations.push(ERROR_MESSAGES[errorKey](label, errorValue));
        } else {
          violations.push(`${label} is invalid`);
        }
      }
    }

    return violations;
  }
}
