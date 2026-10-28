import { FormControl, Validators } from '@angular/forms';

import { TaxOverrideReason } from '../models/tax-override-reason.type';

export const TAX_OVERRIDE_NOTE_MAX_LENGTH = 500;

/** True when a tax rate in percent differs from the customer's computed rate (compared to 4 decimal places). */
export function isTaxOverride(ratePercent: number | null | undefined, defaultPercent: number | null | undefined): boolean {
  return Math.round(Number(ratePercent ?? 0) * 10_000) !== Math.round(Number(defaultPercent ?? 0) * 10_000);
}

/** Makes the reason required while the rate is overridden, and the note required when the reason is Other. */
export function syncTaxOverrideValidators(
  reason: FormControl<TaxOverrideReason | null>,
  note: FormControl<string | null>,
  active: boolean,
): void {
  reason.setValidators(active ? [Validators.required] : []);
  note.setValidators(active && reason.value === 'Other'
    ? [Validators.required, Validators.maxLength(TAX_OVERRIDE_NOTE_MAX_LENGTH)]
    : [Validators.maxLength(TAX_OVERRIDE_NOTE_MAX_LENGTH)]);
  reason.updateValueAndValidity({ emitEvent: false });
  note.updateValueAndValidity({ emitEvent: false });
}

/** The request fields for an override, or none when the rate is the computed one. */
export function taxOverridePayload(
  active: boolean,
  reason: TaxOverrideReason | null | undefined,
  note: string | null | undefined,
): { taxOverrideReason?: TaxOverrideReason; taxOverrideNote?: string } {
  if (!active || !reason) return {};
  const trimmed = note?.trim();
  return { taxOverrideReason: reason, taxOverrideNote: trimmed || undefined };
}
