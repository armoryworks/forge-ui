import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * Like Validators.required, but a string of only whitespace also counts as
 * missing. Reports the same `required` error key so the shared messages apply.
 */
export function requiredTrimmed(control: AbstractControl): ValidationErrors | null {
  const value: unknown = control.value;
  if (value === null || value === undefined) return { required: true };
  if (typeof value === 'string' && value.trim().length === 0) return { required: true };
  if (Array.isArray(value) && value.length === 0) return { required: true };
  return null;
}
