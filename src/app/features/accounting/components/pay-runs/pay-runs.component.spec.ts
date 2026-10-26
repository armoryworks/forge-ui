import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { PayRunsComponent } from './pay-runs.component';
import { PayRunService } from '../../services/pay-run.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { PayRun } from '../../models/pay-run.model';
import { PayRunPostDialogComponent } from '../pay-run-post-dialog/pay-run-post-dialog.component';
import { PayrollImportDialogComponent } from '../payroll-import-dialog/payroll-import-dialog.component';

interface PageApi {
  ngOnInit(): void;
  payRuns(): PayRun[];
  canImport(): boolean;
  openImport(): void;
  openPost(run: PayRun): void;
}

const DRAFT: PayRun = { id: 3, bookId: 1, payDate: '2026-06-15', periodStart: '2026-06-01', periodEnd: '2026-06-14', grossWages: 5000, employeeTaxWithheld: 1000, employerTax: 380, netPay: 4000, status: 'Draft', journalEntryId: null, journalEntryNumber: null };

describe('PayRunsComponent', () => {
  const payRuns = { list: vi.fn() };
  const dialog = { open: vi.fn() };
  const snackbar = { success: vi.fn(), info: vi.fn(), errorFrom: vi.fn() };
  let enabled: Set<string>;

  function create(): PageApi {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: PayRunService, useValue: payRuns },
        { provide: MatDialog, useValue: dialog },
        { provide: SnackbarService, useValue: snackbar },
        { provide: CapabilityService, useValue: { capabilities: signal([]), isEnabled: (code: string) => enabled.has(code) } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    TestBed.overrideComponent(PayRunsComponent, { set: { template: '', imports: [], styles: [] } });
    const api = TestBed.createComponent(PayRunsComponent).componentInstance as unknown as PageApi;
    api.ngOnInit();
    return api;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    enabled = new Set(['CAP-PAYROLL-RUN', 'CAP-ACCT-FULLGL']);
    payRuns.list.mockReturnValue(of([DRAFT]));
  });

  it('lists the book pay runs', () => {
    const api = create();
    expect(payRuns.list).toHaveBeenCalledWith(1);
    expect(api.payRuns()).toEqual([DRAFT]);
  });

  it('offers the register import only while full GL is on', () => {
    expect(create().canImport()).toBe(true);
    enabled.delete('CAP-ACCT-FULLGL');
    expect(create().canImport()).toBe(false);
  });

  it('reloads after a register import and reports warnings', () => {
    dialog.open.mockReturnValue({ afterClosed: () => of({ payRunId: 9, employeeCount: 2, warnings: ['net mismatch'] }) });
    const api = create();
    api.openImport();
    expect(dialog.open).toHaveBeenCalledWith(PayrollImportDialogComponent, expect.objectContaining({ data: { bookId: 1 } }));
    expect(snackbar.info).toHaveBeenCalled();
    expect(payRuns.list).toHaveBeenCalledTimes(2);
  });

  it('posts through the confirmation that shows the journal lines', () => {
    dialog.open.mockReturnValue({ afterClosed: () => of({ ...DRAFT, status: 'Posted', journalEntryId: 70, journalEntryNumber: 12 }) });
    const api = create();
    api.openPost(DRAFT);
    expect(dialog.open).toHaveBeenCalledWith(PayRunPostDialogComponent, expect.objectContaining({ data: { payRun: DRAFT } }));
    expect(snackbar.success).toHaveBeenCalledWith('accounting.payRuns.posted');
    expect(payRuns.list).toHaveBeenCalledTimes(2);
  });
});
