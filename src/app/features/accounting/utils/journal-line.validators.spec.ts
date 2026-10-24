import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { describe, expect, it } from 'vitest';

import { balancedValidator } from './journal-line.validators';

function entry(...sides: [number, number][]): FormGroup {
  return new FormGroup({
    lines: new FormArray(sides.map(([debit, credit]) => new FormGroup({
      debit: new FormControl(debit),
      credit: new FormControl(credit),
    }))),
  });
}

describe('balancedValidator', () => {
  const validate = balancedValidator(() => 'Out of balance');

  it('fails an unbalanced entry with the message the validation popover shows', () => {
    expect(validate(entry([100, 0], [0, 90]))).toEqual({ unbalanced: { message: 'Out of balance' } });
  });

  it('passes a balanced entry and an empty one', () => {
    expect(validate(entry([100, 0], [0, 100]))).toBeNull();
    expect(validate(entry([0, 0], [0, 0]))).toBeNull();
  });

  it('treats sub-cent rounding as balanced', () => {
    expect(validate(entry([100.004, 0], [0, 100]))).toBeNull();
  });
});
