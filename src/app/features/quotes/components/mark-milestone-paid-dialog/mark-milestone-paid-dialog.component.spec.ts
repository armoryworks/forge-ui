import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { vi } from 'vitest';

import { PaymentMilestone } from '../../../../shared/models/payment-milestone.model';
import { PaymentScheduleService } from '../../services/payment-schedule.service';
import { MarkMilestonePaidDialogComponent } from './mark-milestone-paid-dialog.component';

interface DialogInternals {
  form: FormGroup;
  remaining: number;
}

describe('MarkMilestonePaidDialogComponent', () => {
  const milestone: PaymentMilestone = {
    id: 5, sequence: 1, name: 'Deposit', percentage: 30, dueTrigger: 'OnAcceptance',
    dueDate: null, netDays: null, status: 'PartiallyPaid', amountDue: 300, paidAmount: 100,
    invoiceId: null, notes: null,
  };

  let dialog: DialogInternals;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: MAT_DIALOG_DATA, useValue: { milestone } },
        { provide: PaymentScheduleService, useValue: { markPaid: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key === 'quotes.paymentSchedule.paidAmount' ? 'Paid amount' : key } },
      ],
    });
    dialog = TestBed.runInInjectionContext(() => new MarkMilestonePaidDialogComponent()) as unknown as DialogInternals;
  });

  it('prefills the remaining balance', () => {
    expect(dialog.remaining).toBe(200);
    expect(dialog.form.controls['paidAmount'].value).toBe(200);
    expect(dialog.form.valid).toBe(true);
  });

  it('rejects an amount above the remaining balance', () => {
    const amount = dialog.form.controls['paidAmount'];
    amount.setValue(200.01);

    expect(amount.errors).toEqual({ max: { max: 200, actual: 200.01 } });
  });

  it('rejects a third decimal place', () => {
    const amount = dialog.form.controls['paidAmount'];
    amount.setValue(99.999);

    expect(amount.errors?.['maxDecimals'].message).toBe('Paid amount can have at most 2 decimal places');
  });
});
