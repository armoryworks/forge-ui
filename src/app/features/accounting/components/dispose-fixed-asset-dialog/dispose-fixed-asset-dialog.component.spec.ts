import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FormGroup } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';

import { environment } from '../../../../../environments/environment';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { FixedAssetDetail } from '../../models/fixed-asset-detail.model';
import { DisposeFixedAssetDialogComponent } from './dispose-fixed-asset-dialog.component';

type Internals = {
  ngOnInit(): void;
  form: FormGroup;
  bookValueAtDisposal(): number | null;
  catchUp(): number | null;
  gainLoss(): number | null;
  proceedsAccountOptions(): { value: unknown }[];
  confirm(): void;
};

const api = `${environment.apiUrl}/accounting`;
const DETAIL: FixedAssetDetail = {
  asset: { id: 5, bookId: 1, name: 'CNC Mill', assetTag: 'FA-001', cost: 1200, salvageValue: 0, inServiceDate: '2026-01-01', usefulLifeMonths: 12, monthlyDepreciation: 100, accumulatedDepreciation: 100, netBookValue: 1100, status: 'Active', method: 'StraightLine', linkedAssetId: null, usefulLifeUnits: null },
  assetGlAccountId: 150, accumulatedDepreciationGlAccountId: 151, depreciationExpenseGlAccountId: 600, isEditable: false,
  schedule: [
    { periodMonth: '2026-01-01', amount: 100, accumulatedDepreciation: 100, netBookValue: 1100, posted: true, journalEntryId: 41 },
    { periodMonth: '2026-02-01', amount: 100, accumulatedDepreciation: 200, netBookValue: 1000, posted: false, journalEntryId: null },
    { periodMonth: '2026-03-01', amount: 100, accumulatedDepreciation: 300, netBookValue: 900, posted: false, journalEntryId: null },
  ],
};
const ACCOUNTS = [
  { id: 100, accountNumber: '10100', name: 'Cash', accountType: 'Asset', normalBalance: 'Debit', isPostable: true, isControlAccount: false, requiresJob: false, requiresCostCenter: false },
  { id: 120, accountNumber: '12000', name: 'AR', accountType: 'Asset', normalBalance: 'Debit', isPostable: true, isControlAccount: true, requiresJob: false, requiresCostCenter: false },
];

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('DisposeFixedAssetDialogComponent', () => {
  let http: HttpTestingController;
  const dialogRef = { close: vi.fn() };

  function create(): Internals {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { detail: DETAIL } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
      ],
    });
    TestBed.overrideComponent(DisposeFixedAssetDialogComponent, { set: { template: '', imports: [] } });
    http = TestBed.inject(HttpTestingController);
    const c = TestBed.createComponent(DisposeFixedAssetDialogComponent).componentInstance as unknown as Internals;
    c.ngOnInit();
    flushPreview(todayIso(), { catchUpDepreciation: 0, netBookValue: 1100 });
    http.expectOne((r) => r.url === `${api}/accounts`).flush(ACCOUNTS);
    return c;
  }

  function flushPreview(date: string, values: { catchUpDepreciation: number; netBookValue: number }): void {
    const req = http.expectOne(`${api}/fixed-assets/5/dispose/preview`);
    expect(req.request.body).toEqual({ disposalDate: date, proceeds: 0 });
    req.flush({ fixedAssetId: 5, disposalDate: date, proceeds: 0, gainLoss: -values.netBookValue, ...values });
  }

  beforeEach(() => vi.clearAllMocks());
  afterEach(() => http.verify());

  it('shows the server\'s book value after catch-up depreciation and the gain or loss before posting', () => {
    const c = create();
    expect(c.bookValueAtDisposal()).toBe(1100);

    c.form.patchValue({ disposalDate: new Date(2026, 2, 15) });
    expect(c.bookValueAtDisposal()).toBeNull();
    flushPreview('2026-03-15', { catchUpDepreciation: 100, netBookValue: 1000 });

    expect(c.catchUp()).toBe(100);
    expect(c.bookValueAtDisposal()).toBe(1000);
    c.form.patchValue({ proceeds: 1000 });
    expect(c.gainLoss()).toBe(0);
    c.form.patchValue({ proceeds: 700 });
    expect(c.gainLoss()).toBe(-300);
  });

  it('offers only non-control asset accounts for the proceeds', () => {
    const c = create();

    expect(c.proceedsAccountOptions().map((o) => o.value)).toEqual([null, 100]);
  });

  it('requires the proceeds account only when there are proceeds', () => {
    const c = create();
    expect(c.form.valid).toBe(true);

    c.form.patchValue({ proceeds: 500 });
    expect(c.form.valid).toBe(false);
    c.form.patchValue({ proceedsGlAccountId: 100 });
    expect(c.form.valid).toBe(true);
  });

  it('posts the disposal and closes with the result', () => {
    const c = create();
    c.form.patchValue({ disposalDate: new Date(2026, 2, 15), proceeds: 500, proceedsGlAccountId: 100, memo: ' sold ' });
    flushPreview('2026-03-15', { catchUpDepreciation: 100, netBookValue: 1000 });

    c.confirm();

    const req = http.expectOne(`${api}/fixed-assets/5/dispose`);
    expect(req.request.body).toEqual({
      disposalDate: '2026-03-15', proceeds: 500, proceedsGlAccountId: 100, gainLossGlAccountId: null, memo: 'sold',
    });
    const result = { asset: { ...DETAIL.asset, status: 'Disposed' }, journalEntryId: 50, catchUpDepreciation: 100, netBookValue: 1000, proceeds: 500, gainLoss: -500 };
    req.flush(result);
    expect(dialogRef.close).toHaveBeenCalledWith(result);
  });
});
