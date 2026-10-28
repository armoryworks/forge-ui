import { describe, expect, it } from 'vitest';
import { FormControl } from '@angular/forms';

import { TaxOverrideReason } from '../models/tax-override-reason.type';
import { isTaxOverride, syncTaxOverrideValidators, taxOverridePayload } from './tax-override.utils';

describe('tax override utils', () => {
  it('compares rates to four decimal places', () => {
    expect(isTaxOverride(7.25, 7.25)).toBe(false);
    expect(isTaxOverride(7.250000001, 7.25)).toBe(false);
    expect(isTaxOverride(0, 7.25)).toBe(true);
    expect(isTaxOverride(null, 0)).toBe(false);
  });

  it('requires a reason only while overridden and a note only for Other', () => {
    const reason = new FormControl<TaxOverrideReason | null>(null);
    const note = new FormControl<string | null>('');

    syncTaxOverrideValidators(reason, note, false);
    expect(reason.valid).toBe(true);

    syncTaxOverrideValidators(reason, note, true);
    expect(reason.hasError('required')).toBe(true);

    reason.setValue('Resale');
    syncTaxOverrideValidators(reason, note, true);
    expect(note.valid).toBe(true);

    reason.setValue('Other');
    syncTaxOverrideValidators(reason, note, true);
    expect(note.hasError('required')).toBe(true);
  });

  it('sends the reason and trimmed note only for an override', () => {
    expect(taxOverridePayload(false, 'Resale', 'x')).toEqual({});
    expect(taxOverridePayload(true, null, 'x')).toEqual({});
    expect(taxOverridePayload(true, 'Other', '  sample  ')).toEqual({ taxOverrideReason: 'Other', taxOverrideNote: 'sample' });
    expect(taxOverridePayload(true, 'Resale', ' ')).toEqual({ taxOverrideReason: 'Resale', taxOverrideNote: undefined });
  });
});
