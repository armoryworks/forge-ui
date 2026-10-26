import { AbstractControl, FormArray, ValidationErrors, ValidatorFn } from '@angular/forms';

/** A line must carry exactly one non-zero side (debit XOR credit), and neither side may be negative. */
export function lineValidator(control: AbstractControl): ValidationErrors | null {
  const debit = Number(control.get('debit')?.value) || 0;
  const credit = Number(control.get('credit')?.value) || 0;
  if (debit < 0 || credit < 0) return { negativeAmount: true };
  if (debit > 0 && credit > 0) return { bothSides: true };
  if (debit === 0 && credit === 0) return { emptyLine: true };
  return null;
}

/**
 * The whole entry must balance: total debits === total credits, and > 0. Fails with
 * `{ unbalanced: { message } }` so the validation popover can say why posting is blocked.
 */
export function balancedValidator(message: () => string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const lines = (group.get('lines') as FormArray | null)?.controls ?? [];
    let debit = 0;
    let credit = 0;
    for (const line of lines) {
      debit += Number(line.get('debit')?.value) || 0;
      credit += Number(line.get('credit')?.value) || 0;
    }
    if (debit === 0 && credit === 0) return null;
    return Math.abs(debit - credit) < 0.005 ? null : { unbalanced: { message: message() } };
  };
}

/**
 * §7A: the opening journal may not post to an inventory control account; opening stock loads as a costed stock
 * load instead. Fails with `{ inventoryAccount: { message } }` when any line's account is one.
 */
export function noInventoryAccountsValidator(isInventory: (glAccountId: number) => boolean, message: () => string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const lines = (group.get('lines') as FormArray | null)?.controls ?? [];
    const flagged = lines.some((line) => {
      const id = Number(line.get('glAccountId')?.value);
      return id > 0 && isInventory(id);
    });
    return flagged ? { inventoryAccount: { message: message() } } : null;
  };
}
