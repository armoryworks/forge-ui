import { FormControl } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { describe, expect, it } from 'vitest';

import { maxDecimalsValidator } from './max-decimals.validator';

describe('maxDecimalsValidator', () => {
  const validate = (value: unknown, places = 2) =>
    maxDecimalsValidator(places, 'Amount')(new FormControl(value));

  it.each([null, undefined, '', 'abc', 10, 10.5, 10.25, '10.25'])('accepts %s at 2 places', (value) => {
    expect(validate(value)).toBeNull();
  });

  it('rejects a third decimal with a message naming the label', () => {
    expect(validate(99999.999)).toEqual({
      maxDecimals: { max: 2, actual: 3, message: 'Amount can have at most 2 decimal places' },
    });
  });

  it('rejects floating-point noise', () => {
    expect(validate(0.1 + 0.2)?.['maxDecimals'].max).toBe(2);
  });

  it('allows four places for unit values', () => {
    expect(validate(0.3334, 4)).toBeNull();
    expect(validate(0.33335, 4)?.['maxDecimals'].message).toBe('Amount can have at most 4 decimal places');
  });

  it('uses the validation.maxDecimals translation when a translate service is given', () => {
    const translate = {
      instant: (key: string, params: { field: string; max: number }) =>
        key === 'validation.maxDecimals' ? `${params.field} puede tener como máximo ${params.max} decimales` : key,
    } as unknown as TranslateService;

    const errors = maxDecimalsValidator(2, 'Importe', translate)(new FormControl(1.005));

    expect(errors?.['maxDecimals'].message).toBe('Importe puede tener como máximo 2 decimales');
  });

  it('falls back to English when the key is missing from the catalog', () => {
    const translate = { instant: (key: string) => key } as unknown as TranslateService;

    const errors = maxDecimalsValidator(4, 'Unit price', translate)(new FormControl(0.12345));

    expect(errors?.['maxDecimals'].message).toBe('Unit price can have at most 4 decimal places');
  });
});
