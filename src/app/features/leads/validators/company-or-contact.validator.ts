import { AbstractControl, ValidatorFn } from '@angular/forms';

/**
 * Cross-field validator for lead forms: a lead is identified by a company OR a
 * person, so at least one of `companyName` / `contactName` must be present.
 * Attach to the `companyName` control (the message surfaces there via the
 * validation button); the caller must trigger `companyName.updateValueAndValidity()`
 * when `contactName` changes so the rule re-evaluates. The `{ message }` shape
 * is what FormValidationService renders verbatim.
 */
export function companyOrContactRequired(message: string): ValidatorFn {
  return (control: AbstractControl) => {
    const parent = control.parent;
    if (!parent) return null;
    const company = String(parent.get('companyName')?.value ?? '').trim();
    const contact = String(parent.get('contactName')?.value ?? '').trim();
    return company || contact ? null : { companyOrContact: { message } };
  };
}
