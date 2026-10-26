import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { describe, expect, it } from 'vitest';

import { balancedValidator, noInventoryAccountsValidator } from './journal-line.validators';

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

describe('noInventoryAccountsValidator', () => {
  const validate = noInventoryAccountsValidator((id) => id === 40, () => 'Use opening stock');
  const journal = (...accounts: (number | null)[]) => new FormGroup({
    lines: new FormArray(accounts.map((glAccountId) => new FormGroup({ glAccountId: new FormControl(glAccountId) }))),
  });

  it('fails when a line posts to an inventory control account', () => {
    expect(validate(journal(11, 40))).toEqual({ inventoryAccount: { message: 'Use opening stock' } });
  });

  it('passes other accounts and unpicked lines', () => {
    expect(validate(journal(11, null))).toBeNull();
  });
});
