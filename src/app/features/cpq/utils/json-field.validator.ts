import { AbstractControl, ValidationErrors } from '@angular/forms';

/** An admin-authored JSON field: empty is fine, otherwise it must parse. */
export function jsonFieldValidator(control: AbstractControl<string | null>): ValidationErrors | null {
  const text = (control.value ?? '').trim();
  if (!text) return null;
  try {
    JSON.parse(text);
    return null;
  } catch {
    return { json: true };
  }
}
