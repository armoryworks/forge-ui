import { AbstractControl, ValidationErrors, Validators } from '@angular/forms';

export const COUNTRY_CODE_PATTERN = /^\s*([A-Za-z]{2})?\s*$/;

export const countryCodeValidator = Validators.pattern(COUNTRY_CODE_PATTERN);

export function positiveValidator(control: AbstractControl<number | null>): ValidationErrors | null {
  const value = control.value;
  if (value === null || value === undefined || (value as unknown) === '') return null;
  return Number(value) > 0 ? null : { positive: true };
}
