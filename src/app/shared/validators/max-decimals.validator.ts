import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';

import { decimalPlacesOf } from '../utils/money';

/**
 * Rejects a number with more than `places` decimal places, so a value the server column would
 * silently round is caught in the form instead. Blank and non-numeric values pass; pair with
 * `Validators.required` where needed. The error carries its own message, naming `label`, in the
 * app language when `translate` is given (`validation.maxDecimals`), otherwise in English.
 */
export function maxDecimalsValidator(places: number, label: string, translate?: TranslateService): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined || value === '') return null;
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num) || decimalPlacesOf(num) <= places) return null;
    const text = translate?.instant('validation.maxDecimals', { field: label, max: places });
    return {
      maxDecimals: {
        max: places,
        actual: decimalPlacesOf(num),
        message: typeof text === 'string' && text !== 'validation.maxDecimals'
          ? text
          : `${label} can have at most ${places} decimal places`,
      },
    };
  };
}
