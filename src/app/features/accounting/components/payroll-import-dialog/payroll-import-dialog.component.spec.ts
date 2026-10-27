import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { PayrollImportDialogComponent } from './payroll-import-dialog.component';
import { PayRunService } from '../../services/pay-run.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { PayrollRegisterPreview } from '../../models/payroll-register-preview.model';

interface DialogApi {
  form: FormGroup;
  loadPreview(file: File): void;
  import(): void;
  problems(): string[];
  canImport(): boolean;
  mismatchCount(): number;
  mapping(): { category: string; headers: string }[];
}

const GOOD: PayrollRegisterPreview = {
  columns: { employee: ['Employee Name'], gross: ['Gross Pay'], ficaEmployee: ['Social Security', 'Medicare'], net: ['Net Pay'] },
  rows: [
    { employeeName: 'Last, First', gross: 2000, withholdings: 393, employerTax: 153, reportedNet: 1607, computedNet: 1607, netMismatch: false },
    { employeeName: 'Other, Person', gross: 1000, withholdings: 100, employerTax: 76, reportedNet: 850, computedNet: 900, netMismatch: true },
  ],
  grossWages: 3000, employeeTaxWithheld: 493, employerTax: 229, netPay: 2507, errors: [],
};

describe('PayrollImportDialogComponent', () => {
  const payRuns = { previewRegister: vi.fn(), importRegister: vi.fn() };
  const dialogRef = { close: vi.fn() };
  const file = new File(['Employee Name,Gross Pay\n'], 'register.csv', { type: 'text/csv' });

  function create(): DialogApi {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: PayRunService, useValue: payRuns },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { bookId: 1 } },
        { provide: SnackbarService, useValue: { errorFrom: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    TestBed.overrideComponent(PayrollImportDialogComponent, { set: { template: '', imports: [], styles: [] } });
    return TestBed.createComponent(PayrollImportDialogComponent).componentInstance as unknown as DialogApi;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    payRuns.previewRegister.mockReturnValue(of(GOOD));
    payRuns.importRegister.mockReturnValue(of({ payRunId: 4, employeeCount: 2, grossWages: 3000, employeeTaxWithheld: 493, employerTax: 229, netPay: 2507, warnings: [] }));
  });

  it('previews the chosen register with its column mapping and net mismatches', () => {
    const api = create();
    api.loadPreview(file);
    expect(payRuns.previewRegister).toHaveBeenCalledWith(file);
    expect(api.mismatchCount()).toBe(1);
    expect(api.mapping().find((m) => m.category === 'ficaEmployee')?.headers).toBe('Social Security, Medicare');
    expect(api.mapping().find((m) => m.category === 'state')?.headers).toBe('');
    expect(api.canImport()).toBe(true);
  });

  it('lists the problems that stop the import and keeps the button off', () => {
    payRuns.previewRegister.mockReturnValue(of({ ...GOOD, rows: [], errors: ['missing-required-columns'] }));
    const api = create();
    api.loadPreview(file);
    expect(api.problems()).toEqual(['accounting.payRuns.errors.missing-required-columns']);
    expect(api.canImport()).toBe(false);
    api.import();
    expect(payRuns.importRegister).not.toHaveBeenCalled();
  });

  it('imports the register as a draft for the pay date and period', () => {
    const api = create();
    api.loadPreview(file);
    api.form.setValue({ payDate: new Date(2026, 5, 15), periodStart: new Date(2026, 5, 1), periodEnd: new Date(2026, 5, 14) });
    api.import();
    expect(payRuns.importRegister).toHaveBeenCalledWith(1, '2026-06-15', '2026-06-01', '2026-06-14', file);
    expect(dialogRef.close).toHaveBeenCalledWith(expect.objectContaining({ payRunId: 4 }));
  });
});
