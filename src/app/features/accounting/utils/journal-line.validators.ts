import { AbstractControl, FormArray, ValidationErrors } from '@angular/forms';

/** A line must carry exactly one non-zero side (debit XOR credit). */
export function lineValidator(control: AbstractControl): ValidationErrors | null {
  const debit = Number(control.get('debit')?.value) || 0;
  const credit = Number(control.get('credit')?.value) || 0;
  if (debit > 0 && credit > 0) return { bothSides: true };
  if (debit === 0 && credit === 0) return { emptyLine: true };
  return null;
}

/** The whole entry must balance: total debits === total credits, and > 0. */
export function balancedValidator(group: AbstractControl): ValidationErrors | null {
  const lines = (group.get('lines') as FormArray | null)?.controls ?? [];
  let debit = 0;
  let credit = 0;
  for (const line of lines) {
    debit += Number(line.get('debit')?.value) || 0;
    credit += Number(line.get('credit')?.value) || 0;
  }
  if (debit === 0 && credit === 0) return null;
  return Math.abs(debit - credit) < 0.005 ? null : { unbalanced: true };
}
