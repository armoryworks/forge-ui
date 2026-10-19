import { AbstractControl, Validators } from '@angular/forms';

import { requiredTrimmed } from './required-trimmed.validator';

/**
 * True when the control carries a required validator, so the shared field
 * components can draw the required marker without a separate `[required]` flag.
 */
export function controlIsRequired(control: AbstractControl | null): boolean {
  if (!control) return false;
  return control.hasValidator(Validators.required) || control.hasValidator(requiredTrimmed);
}
