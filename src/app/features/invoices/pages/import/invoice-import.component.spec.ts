import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { CapabilityService } from '../../../../shared/services/capability.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { DataImportResult } from '../../../../shared/models/data-import-result.model';
import { InvoiceImportService } from '../../services/invoice-import.service';
import { InvoiceImportRow } from '../../models/invoice-import-row.model';
import { InvoiceImportPageComponent } from './invoice-import.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

type Internals = {
  rows(): InvoiceImportRow[];
  parseErrors(): string[];
  invoiceCount(): number;
  fullGl(): boolean;
  canCommit(): boolean;
  load(text: string): void;
  validate(): void;
  commit(): void;
};

const CSV = [
  'Invoice #,Customer,Invoice Date,Due Date,Description,Qty,Unit Price,Tax,Total,Paid,Status',
  'INV-1,C-12,11/03/2025,12/03/2025,Brackets,100,$4.50,32.63,"$482.63",482.63,Paid',
  'INV-2,C-12,2025-12-01,2025-12-31,Setup,1,150,0,150,0,Open',
  'INV-2,C-12,2025-12-01,2025-12-31,Freight,1,25,0,150,0,Open',
].join('\n');

function result(overrides: Partial<DataImportResult> = {}): DataImportResult {
  return { totalRows: 3, validCount: 3, invalidCount: 0, createdCount: 0, committed: false, rows: [], ...overrides };
}

describe('InvoiceImportPageComponent', () => {
  let validate: ReturnType<typeof vi.fn>;
  let commit: ReturnType<typeof vi.fn>;

  function page(fullGl = false): Internals {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: InvoiceImportService, useValue: { validate, commit } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: CapabilityService, useValue: { isEnabled: (code: string) => code === 'CAP-ACCT-FULLGL' && fullGl } },
      ],
    });
    return TestBed.runInInjectionContext(() => new InvoiceImportPageComponent()) as unknown as Internals;
  }

  beforeEach(() => {
    validate = vi.fn(() => of(result()));
    commit = vi.fn(() => of(result({ committed: true, createdCount: 2 })));
  });

  it('maps money, dates and status, and counts invoices across their line rows', () => {
    const p = page();

    p.load(CSV);

    expect(p.parseErrors()).toEqual([]);
    expect(p.rows()).toHaveLength(3);
    expect(p.invoiceCount()).toBe(2);
    expect(p.rows()[0]).toMatchObject({
      invoiceNumber: 'INV-1', customer: 'C-12', invoiceDate: '2025-11-03T00:00:00Z', dueDate: '2025-12-03T00:00:00Z',
      description: 'Brackets', quantity: 100, unitPrice: 4.5, tax: 32.63, total: 482.63, paidAmount: 482.63, status: 'Paid',
    });
  });

  it('commits only after a clean validation', () => {
    const p = page();
    p.load(CSV);
    expect(p.canCommit()).toBe(false);

    p.validate();
    p.commit();

    expect(validate).toHaveBeenCalledWith(p.rows());
    expect(commit).toHaveBeenCalledWith(p.rows());
  });

  it('says the imported invoices stay off the ledger, worded for full GL when it is on', () => {
    expect(page(false).fullGl()).toBe(false);
    expect(page(true).fullGl()).toBe(true);
  });

  it('flags unreadable money before anything is sent', () => {
    const p = page();

    p.load('Invoice #,Customer,Invoice Date,Total\nINV-9,C-1,2025-01-01,abc\n');

    expect(p.parseErrors()).toHaveLength(1);
    p.validate();
    expect(validate).not.toHaveBeenCalled();
  });
});
