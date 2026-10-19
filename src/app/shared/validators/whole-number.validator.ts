import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * Rejects a number with a fractional part. Empty values pass; pair with a
 * required validator when the field must be filled.
 */
export function wholeNumber(control: AbstractControl): ValidationErrors | null {
  const value: unknown = control.value;
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(num) ? null : { wholeNumber: true };
}
