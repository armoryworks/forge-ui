import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** A North American number as the phone input formats it: `(999) 999-9999`, optionally after `+1 `. */
export const PHONE_PATTERN = /^(\+1 )?\(\d{3}\) \d{3}-\d{4}$/;

const EXTENSION = /\s*(?:ext\.?|extension|x|#)\s*\d{1,6}\s*$/i;
const PHONE_CHARACTERS = /^\+?[\d\s().-]+$/;
const MIN_DIGITS = 7;
const MAX_DIGITS = 15;

/**
 * Accepts international numbers (an optional leading `+`, then 7–15 digits written with spaces,
 * dots, dashes or parentheses, e.g. `+49 711 123456`) and an optional extension. A North American
 * number (ten digits, or eleven starting with 1, without another country code) must be in the
 * `(999) 999-9999` form the phone input formats it to. Empty values pass; pair with `required`.
 */
export const phoneValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = typeof control.value === 'string' ? control.value.trim() : '';
  if (!value) return null;
  const main = value.replace(EXTENSION, '');
  const digits = main.replace(/\D/g, '');
  const invalid = { pattern: { requiredPattern: 'phone', actualValue: control.value } };
  if (!PHONE_CHARACTERS.test(main) || digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return invalid;

  const international = main.startsWith('+') && !main.startsWith('+1 ') && !main.startsWith('+1(');
  const northAmerican = !international
    && (digits.length === 10 && !main.startsWith('+') || digits.length === 11 && digits.startsWith('1'));
  if (northAmerican && !PHONE_PATTERN.test(main)) return invalid;
  return null;
};
