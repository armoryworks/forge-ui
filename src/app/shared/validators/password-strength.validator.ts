import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Mirrors the server-side ASP.NET Identity password policy (Program.cs):
 * minimum 8 characters, at least one uppercase letter, one lowercase letter,
 * and one digit (non-alphanumeric NOT required). Catching this client-side
 * stops the form from submitting a password the server will only reject with
 * a confusing "Password requirements not met" error.
 *
 * Returns a `{ message }` error so {@link FormValidationService} surfaces the
 * specific requirement text in the validation popover rather than a generic
 * "Password format is invalid".
 */
export const passwordStrengthValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value;
  if (!value) return null; // `required` owns the empty case.

  const longEnough = value.length >= 8;
  const hasUpper = /[A-Z]/.test(value);
  const hasLower = /[a-z]/.test(value);
  const hasDigit = /\d/.test(value);

  if (longEnough && hasUpper && hasLower && hasDigit) return null;

  return {
    passwordStrength: {
      message: 'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a number.',
    },
  };
};
