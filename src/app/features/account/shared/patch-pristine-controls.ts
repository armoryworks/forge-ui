import { FormGroup } from '@angular/forms';

/**
 * Copies `values` into the controls of `form` the user has not edited yet, so data that
 * arrives after the page opened fills the form without overwriting anything typed meanwhile.
 */
export function patchPristineControls<T extends Record<string, unknown>>(form: FormGroup, values: T): void {
  for (const [key, value] of Object.entries(values)) {
    const control = form.get(key);
    if (control && control.pristine) control.setValue(value, { emitEvent: true });
  }
}
