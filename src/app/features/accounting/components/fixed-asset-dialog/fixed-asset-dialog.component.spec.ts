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
import { FixedAssetDialogComponent, FixedAssetDialogData } from './fixed-asset-dialog.component';

type Internals = {
  ngOnInit(): void;
  form: FormGroup;
  unitsBased(): boolean;
  assetAccountOptions(): { value: unknown }[];
  expenseAccountOptions(): { value: unknown }[];
  linkableOptions(): { value: unknown }[];
  save(): void;
};

const api = `${environment.apiUrl}/accounting`;
const ACCOUNTS = [
  { id: 150, accountNumber: '15000', name: 'Equipment', accountType: 'Asset', normalBalance: 'Debit', isPostable: true, isControlAccount: false, requiresJob: false, requiresCostCenter: false },
  { id: 151, accountNumber: '15900', name: 'Accumulated', accountType: 'Asset', normalBalance: 'Credit', isPostable: true, isControlAccount: false, requiresJob: false, requiresCostCenter: false },
  { id: 120, accountNumber: '12000', name: 'AR', accountType: 'Asset', normalBalance: 'Debit', isPostable: true, isControlAccount: true, requiresJob: false, requiresCostCenter: false },
  { id: 600, accountNumber: '62000', name: 'Depreciation', accountType: 'Expense', normalBalance: 'Debit', isPostable: true, isControlAccount: false, requiresJob: false, requiresCostCenter: false },
];
const LINKABLE = [
  { id: 7, name: 'Mold A', serialNumber: 'M-7', acquisitionCost: 5000, currentShotCount: 10, linkedFixedAssetId: null },
  { id: 8, name: 'Press', serialNumber: null, acquisitionCost: null, currentShotCount: 0, linkedFixedAssetId: 99 },
];
const DETAIL: FixedAssetDetail = {
  asset: { id: 5, bookId: 1, name: 'CNC Mill', assetTag: 'FA-001', cost: 1200, salvageValue: 0, inServiceDate: '2026-01-01', usefulLifeMonths: 12, monthlyDepreciation: 100, accumulatedDepreciation: 0, netBookValue: 1200, status: 'Active', method: 'StraightLine', linkedAssetId: null, usefulLifeUnits: null },
  assetGlAccountId: 150, accumulatedDepreciationGlAccountId: 151, depreciationExpenseGlAccountId: 600, isEditable: true, schedule: [],
};

describe('FixedAssetDialogComponent', () => {
  let http: HttpTestingController;
  const dialogRef = { close: vi.fn() };

  function create(data: FixedAssetDialogData): Internals {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
      ],
    });
    TestBed.overrideComponent(FixedAssetDialogComponent, { set: { template: '', imports: [] } });
    http = TestBed.inject(HttpTestingController);
    const c = TestBed.createComponent(FixedAssetDialogComponent).componentInstance as unknown as Internals;
    c.ngOnInit();
    http.expectOne((r) => r.url === `${api}/accounts`).flush(ACCOUNTS);
    http.expectOne(`${api}/fixed-assets/linkable-assets?bookId=1`).flush(LINKABLE);
    return c;
  }

  beforeEach(() => vi.clearAllMocks());
  afterEach(() => http.verify());

  function fill(c: Internals): void {
    c.form.patchValue({
      name: 'Lathe', cost: 3600, salvageValue: 0, inServiceDate: new Date(2026, 0, 15), usefulLifeMonths: 36,
      assetGlAccountId: 150, accumulatedDepreciationGlAccountId: 151, depreciationExpenseGlAccountId: 600,
    });
  }

  it('offers non-control asset accounts, expense accounts and unlinked operational assets', () => {
    const c = create({ bookId: 1 });

    expect(c.assetAccountOptions().map((o) => o.value)).toEqual([150, 151]);
    expect(c.expenseAccountOptions().map((o) => o.value)).toEqual([600]);
    expect(c.linkableOptions().map((o) => o.value)).toEqual([null, 7]);
  });

  it('pre-fills the name and cost from the linked asset', () => {
    const c = create({ bookId: 1 });

    c.form.get('linkedAssetId')!.setValue(7);

    expect(c.form.get('name')!.value).toBe('Mold A');
    expect(c.form.get('cost')!.value).toBe(5000);
  });

  it('requires units and a linked asset for units of production', () => {
    const c = create({ bookId: 1 });
    fill(c);
    expect(c.form.valid).toBe(true);

    c.form.get('method')!.setValue('UnitsOfProduction');

    expect(c.unitsBased()).toBe(true);
    expect(c.form.valid).toBe(false);
    c.form.patchValue({ usefulLifeUnits: 100000, linkedAssetId: 7 });
    expect(c.form.valid).toBe(true);
  });

  it('registers the asset in the book', () => {
    const c = create({ bookId: 1 });
    fill(c);

    c.save();

    const req = http.expectOne(`${api}/fixed-assets`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(expect.objectContaining({
      bookId: 1, name: 'Lathe', cost: 3600, inServiceDate: '2026-01-15', usefulLifeMonths: 36, method: 'StraightLine', usefulLifeUnits: null,
    }));
    req.flush({ id: 9 });
    expect(dialogRef.close).toHaveBeenCalledWith({ id: 9 });
  });

  it('edits an existing asset with a PUT', () => {
    const c = create({ bookId: 1, detail: DETAIL });
    expect(c.form.get('name')!.value).toBe('CNC Mill');
    expect(c.form.get('depreciationExpenseGlAccountId')!.value).toBe(600);

    c.form.get('cost')!.setValue(1500);
    c.save();

    const req = http.expectOne(`${api}/fixed-assets/5`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.cost).toBe(1500);
    expect(req.request.body.bookId).toBeUndefined();
    req.flush(DETAIL);
  });
});
