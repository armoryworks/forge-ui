import { FormGroup, AbstractControl } from '@angular/forms';
import { Signal, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
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
  static getViolations(
    form: FormGroup,
    labels: Record<string, string>,
  ): Signal<string[]> {
    const status = toSignal(form.statusChanges.pipe(startWith(form.status)));

    return computed(() => {
      // Read status signal to trigger recomputation
      status();

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
    });
  }
}
