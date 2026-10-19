import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Fails when this date control is earlier than the sibling control named
 * `otherControlName`. Either value missing passes. The caller re-runs this
 * control's validation when the sibling changes.
 */
export function onOrAfter(otherControlName: string, message: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const start = toTime(control.parent?.get(otherControlName)?.value);
    const end = toTime(control.value);
    if (start === null || end === null) return null;
    return end < start ? { onOrAfter: { message } } : null;
  };
}

function toTime(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value as string | number);
  const time = date.getTime();
  if (Number.isNaN(time)) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}
