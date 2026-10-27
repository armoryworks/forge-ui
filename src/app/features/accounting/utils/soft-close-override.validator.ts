import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

import { FiscalPeriodStatus } from '../models/accounting.models';

/**
 * The entry date's period decides whether a manual entry can post: a hard-closed period never takes one
 * (`{ periodHardClosed: { message } }`); a soft-closed period takes one only with the override ticked and a
 * reason given (`{ softClosedOverrideRequired: { message } }`). Reads `overrideSoftClose` and `overrideReason`
 * from the group.
 */
export function softCloseOverrideValidator(
  periodStatus: () => FiscalPeriodStatus | null,
  messages: { hardClosed: () => string; overrideRequired: () => string },
): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const status = periodStatus();
    if (status === 'HardClosed') return { periodHardClosed: { message: messages.hardClosed() } };
    if (status !== 'SoftClosed') return null;
    const ticked = group.get('overrideSoftClose')?.value === true;
    const reason = String(group.get('overrideReason')?.value ?? '').trim();
    return ticked && reason.length > 0 ? null : { softClosedOverrideRequired: { message: messages.overrideRequired() } };
  };
}
