import { FormControl } from '@angular/forms';

import { wholeNumber } from './whole-number.validator';

describe('wholeNumber', () => {
  it('accepts blanks and whole numbers', () => {
    for (const v of [null, '', 0, 3, '4']) {
      expect(wholeNumber(new FormControl(v))).toBeNull();
    }
  });

  it('rejects fractions', () => {
    expect(wholeNumber(new FormControl(1.5))).toEqual({ wholeNumber: true });
  });
});
