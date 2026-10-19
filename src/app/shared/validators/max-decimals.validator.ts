import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

import { decimalPlacesOf } from '../utils/money';

/**
 * Rejects a number with more than `places` decimal places, so a value the server column would
 * silently round is caught in the form instead. Blank and non-numeric values pass; pair with
 * `Validators.required` where needed. The error carries its own message, naming `label`.
 */
export function maxDecimalsValidator(places: number, label: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined || value === '') return null;
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num) || decimalPlacesOf(num) <= places) return null;
    return {
      maxDecimals: {
        max: places,
        actual: decimalPlacesOf(num),
        message: `${label} can have at most ${places} decimal places`,
      },
    };
  };
}
