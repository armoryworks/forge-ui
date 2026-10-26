import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { PayRunPostDialogComponent } from './pay-run-post-dialog.component';
import { PayRunService } from '../../services/pay-run.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { PayRun } from '../../models/pay-run.model';

interface DialogApi {
  ngOnInit(): void;
  canPost(): boolean;
  unmapped(): string[];
  totalDebit(): number;
  post(): void;
}

const RUN: PayRun = { id: 3, bookId: 1, payDate: '2026-06-15', periodStart: '2026-06-01', periodEnd: '2026-06-14', grossWages: 5000, employeeTaxWithheld: 1000, employerTax: 0, netPay: 4000, status: 'Draft', journalEntryId: null, journalEntryNumber: null };
const MAPPED = [
  { accountKey: 'WAGE_EXPENSE', glAccountId: 60, accountNumber: '60100', accountName: 'Wages', debit: 5000, credit: 0, description: 'Gross wages' },
  { accountKey: 'NET_PAY_PAYABLE', glAccountId: 26, accountNumber: '26400', accountName: 'Net Pay Payable', debit: 0, credit: 4000, description: 'Net pay payable' },
  { accountKey: 'EMPLOYEE_TAX_PAYABLE', glAccountId: 27, accountNumber: '26200', accountName: 'Employee Taxes', debit: 0, credit: 1000, description: 'Employee tax withheld' },
];

describe('PayRunPostDialogComponent', () => {
  const payRuns = { journalPreview: vi.fn(), post: vi.fn() };
  const dialogRef = { close: vi.fn() };

  function create(): DialogApi {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: PayRunService, useValue: payRuns },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { payRun: RUN } },
        { provide: SnackbarService, useValue: { errorFrom: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    TestBed.overrideComponent(PayRunPostDialogComponent, { set: { template: '', imports: [], styles: [] } });
    const api = TestBed.createComponent(PayRunPostDialogComponent).componentInstance as unknown as DialogApi;
    api.ngOnInit();
    return api;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    payRuns.journalPreview.mockReturnValue(of(MAPPED));
    payRuns.post.mockReturnValue(of({ ...RUN, status: 'Posted', journalEntryId: 70, journalEntryNumber: 12 }));
  });

  it('shows the journal lines first and posts on confirm', () => {
    const api = create();
    expect(payRuns.journalPreview).toHaveBeenCalledWith(3);
    expect(api.totalDebit()).toBe(5000);
    expect(api.canPost()).toBe(true);

    api.post();
    expect(payRuns.post).toHaveBeenCalledWith(3);
    expect(dialogRef.close).toHaveBeenCalledWith(expect.objectContaining({ status: 'Posted', journalEntryNumber: 12 }));
  });

  it('blocks the post while an account key is unmapped', () => {
    payRuns.journalPreview.mockReturnValue(of([{ ...MAPPED[0], glAccountId: null, accountNumber: null, accountName: null }, MAPPED[1], MAPPED[2]]));
    const api = create();
    expect(api.unmapped()).toEqual(['WAGE_EXPENSE']);
    expect(api.canPost()).toBe(false);
    api.post();
    expect(payRuns.post).not.toHaveBeenCalled();
  });
});
