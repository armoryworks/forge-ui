import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { SelectOption } from '../../../../shared/components/select/select.component';
import { StockLoad } from '../../models/stock-load.model';
import { StockLoadContext, StockLoadValidationResult } from '../../models/stock-load-validation.model';
import { OpeningStockComponent } from './opening-stock.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

type Internals = {
  ngOnInit(): void;
  form: FormGroup;
  modeOptions(): SelectOption[];
  loads(): unknown[];
  selected(): StockLoad | null;
  gridRows(): { lineNumber: number; errors: string; warnings: string }[];
  unsavedRowErrors(): { row: number; message: string }[];
  reconciliation(): unknown;
  canPost(): boolean;
  csvText: { set(v: string | null): void };
  fileName: { set(v: string | null): void };
  save(): void;
  post(): void;
  voidLoad(): void;
};

const base = `${environment.apiUrl}/accounting/conversion/stock-loads`;

const reconciliation = {
  bookId: 1, storeValue: 0, glInventoryBalance: 0, glWorkInProcessBalance: 0, glStockedBalance: 0, variance: 0,
  isReconciled: true, roundingTolerance: 0.01, accounts: [], reconcilingItems: [],
};

function context(overrides: Partial<StockLoadContext> = {}): StockLoadContext {
  return { bookId: 1, bookName: 'Main', openingJournalDate: '2026-01-01', openingJournalInventory: [], connectedMode: false, ...overrides };
}

function load(overrides: Partial<StockLoad> = {}): StockLoad {
  return {
    id: 9, loadNumber: 'SL-000001', bookId: 1, asOfDate: '2026-01-01', status: 'Draft', glMode: 'OffsetEquity',
    sourceFileName: 'opening.csv', notes: null, totalValue: 188400, journalEntryId: null, journalEntryNumber: null,
    postedAt: null, voidedAt: null, createdAt: '2026-01-02T00:00:00Z', version: 1,
    lines: [
      { id: 1, lineNumber: 1, partId: 3, partNumber: 'FG-310', partDescription: 'Housing', storageLocationId: 4, locationName: 'A1', lotNumber: null, expirationDate: null, quantity: 200, unitCost: 471, extendedValue: 94200 },
      { id: 2, lineNumber: 2, partId: 5, partNumber: 'RM-100', partDescription: 'Resin', storageLocationId: 4, locationName: 'A1', lotNumber: null, expirationDate: null, quantity: 1000, unitCost: 94.2, extendedValue: 94200 },
    ],
    ...overrides,
  };
}

function validation(overrides: Partial<StockLoadValidationResult> = {}): StockLoadValidationResult {
  return {
    isValid: true, issues: [],
    accountTotals: [{ glAccountId: 1, accountNumber: '13100', accountName: 'Raw', total: 94200 }],
    grandTotal: 188400, ...overrides,
  };
}

describe('OpeningStockComponent', () => {
  let http: HttpTestingController;
  let snackbar: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; errorFrom: ReturnType<typeof vi.fn> };
  let confirmed = true;

  beforeEach(() => {
    confirmed = true;
    snackbar = { success: vi.fn(), error: vi.fn(), errorFrom: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
        { provide: SnackbarService, useValue: snackbar },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(confirmed) }) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function open(ctx = context()): Internals {
    const c = TestBed.runInInjectionContext(() => new OpeningStockComponent()) as unknown as Internals;
    c.ngOnInit();
    http.expectOne(`${base}/context`).flush(ctx);
    http.expectOne((r) => r.url === base && r.params.get('bookId') === '1').flush([]);
    http.expectOne((r) => r.url === `${base}/reconciliation`).flush(reconciliation);
    return c;
  }

  it('offers valuation only when the opening journal already carries inventory', () => {
    expect(open().modeOptions().map((o) => o.value)).toEqual(['OffsetEquity']);
    expect(open(context({
      openingJournalInventory: [{ glAccountId: 1, accountNumber: '13100', accountName: 'Raw', total: 132900 }],
    })).modeOptions().map((o) => o.value)).toEqual(['OffsetEquity', 'ValuationOnly']);
  });

  it('saves the uploaded CSV as a draft, then dry-runs it and shows the findings per line', () => {
    const c = open();
    c.csvText.set('partNumber,location,lot,expirationDate,quantity,unitCost\nFG-310,A1,,,200,471');
    c.fileName.set('opening.csv');

    c.save();

    const create = http.expectOne((r) => r.method === 'POST' && r.url === base);
    expect(create.request.body).toEqual(expect.objectContaining({
      bookId: 1, asOfDate: '2026-01-01', glMode: 'OffsetEquity', sourceFileName: 'opening.csv',
      csvContent: expect.stringContaining('FG-310'),
    }));
    create.flush(load());
    http.expectOne(`${base}/9/validate`).flush(validation({
      isValid: false,
      issues: [
        { lineNumber: 2, code: 'stock-load-location-not-empty', severity: 'Error', message: 'occupied' },
        { lineNumber: 1, code: 'stock-load-zero-cost', severity: 'Warning', message: 'zero' },
      ],
    }));
    http.expectOne((r) => r.url === base && r.method === 'GET').flush([]);

    expect(c.selected()?.loadNumber).toBe('SL-000001');
    expect(c.gridRows()[1].errors).toBe('occupied');
    expect(c.gridRows()[0].warnings).toBe('zero');
    expect(c.canPost()).toBe(false);
  });

  it('puts the rows the server refused on their row numbers', () => {
    const c = open();
    c.csvText.set('partNumber,quantity,unitCost\nNOPE,1,1');

    c.save();

    http.expectOne((r) => r.method === 'POST' && r.url === base).flush(
      { errors: [{ field: 'lines[0].partNumber', message: 'Row 1: no part numbered NOPE.', code: 'stock-load-unknown-part' }] },
      { status: 400, statusText: 'Bad Request' });

    expect(c.unsavedRowErrors()).toEqual([
      { row: 1, code: 'stock-load-unknown-part', message: 'Row 1: no part numbered NOPE.' },
    ]);
    expect(c.selected()).toBeNull();
  });

  it('posts a clean draft and refreshes the tie-out', () => {
    const c = open();
    c.csvText.set('x');
    c.save();
    http.expectOne((r) => r.method === 'POST' && r.url === base).flush(load());
    http.expectOne(`${base}/9/validate`).flush(validation());
    http.expectOne((r) => r.url === base && r.method === 'GET').flush([]);
    expect(c.canPost()).toBe(true);

    c.post();

    http.expectOne(`${base}/9/post`).flush(load({ status: 'Posted', journalEntryId: 77, journalEntryNumber: 12 }));
    http.expectOne((r) => r.url === base && r.method === 'GET').flush([]);
    http.expectOne((r) => r.url === `${base}/reconciliation`).flush(reconciliation);
    expect(c.selected()?.status).toBe('Posted');
    expect(snackbar.success).toHaveBeenCalled();
  });

  it('voids a posted load once confirmed', () => {
    const c = open();
    c.csvText.set('x');
    c.save();
    http.expectOne((r) => r.method === 'POST' && r.url === base).flush(load());
    http.expectOne(`${base}/9/validate`).flush(validation());
    http.expectOne((r) => r.url === base && r.method === 'GET').flush([]);
    c.post();
    http.expectOne(`${base}/9/post`).flush(load({ status: 'Posted' }));
    http.expectOne((r) => r.url === base && r.method === 'GET').flush([]);
    http.expectOne((r) => r.url === `${base}/reconciliation`).flush(reconciliation);

    c.voidLoad();

    http.expectOne(`${base}/9/void`).flush(load({ status: 'Voided' }));
    http.expectOne((r) => r.url === base && r.method === 'GET').flush([]);
    http.expectOne((r) => r.url === `${base}/reconciliation`).flush(reconciliation);
    expect(c.selected()?.status).toBe('Voided');
  });
});
