import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

import { toDateOnly } from '../utils/date.utils';

/**
 * Group validator: fails with `{ dateRangeOrder: { message, field } }` when the `endKey` control's
 * calendar day falls before the `startKey` control's. Either side empty passes. `field` is the end
 * control so the validation popover can jump to it.
 */
export function dateOrderValidator(startKey: string, endKey: string, message: () => string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const start = toDateOnly(group.get(startKey)?.value);
    const end = toDateOnly(group.get(endKey)?.value);
    if (!start || !end || end >= start) return null;
    return { dateRangeOrder: { message: message(), field: endKey } };
  };
}
