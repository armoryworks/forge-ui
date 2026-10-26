import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideTranslateService } from '@ngx-translate/core';

import { SEEDED_PAYMENT_TERMS } from '../../../shared/models/payment-terms.fixture';
import { PaymentTermDialogComponent, PaymentTermDialogData } from './payment-term-dialog.component';

interface DialogInternals {
  form: { controls: Record<string, { value: unknown; disabled: boolean; setValue(v: unknown): void }>; invalid: boolean; hasError(code: string): boolean };
  save(): void;
}

describe('PaymentTermDialogComponent', () => {
  const close = vi.fn();

  function build(data: PaymentTermDialogData): DialogInternals {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    });
    return TestBed.runInInjectionContext(() => new PaymentTermDialogComponent()) as unknown as DialogInternals;
  }

  beforeEach(() => close.mockReset());

  it('refuses a discount that runs to or past the net date', () => {
    const dialog = build({});
    dialog.form.controls['code'].setValue('3/30Net30');
    dialog.form.controls['name'].setValue('3/30 Net 30');
    dialog.form.controls['netDays'].setValue(30);
    dialog.form.controls['discountPercent'].setValue(3);
    dialog.form.controls['discountDays'].setValue(30);

    expect(dialog.form.hasError('discountDays')).toBe(true);
    dialog.form.controls['discountDays'].setValue(15);
    expect(dialog.form.invalid).toBe(false);

    dialog.save();
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ code: '3/30Net30', discountPercent: 3, discountDays: 15, netDays: 30 }));
  });

  it('locks everything but the name and sort order on system terms', () => {
    const dialog = build({ term: SEEDED_PAYMENT_TERMS[8] });

    expect(dialog.form.controls['discountPercent'].disabled).toBe(true);
    expect(dialog.form.controls['netDays'].disabled).toBe(true);
    expect(dialog.form.controls['name'].disabled).toBe(false);
  });
});
