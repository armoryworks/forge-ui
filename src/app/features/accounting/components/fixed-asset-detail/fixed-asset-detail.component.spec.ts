import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { FixedAssetDetail } from '../../models/fixed-asset-detail.model';
import { DisposeFixedAssetDialogComponent } from '../dispose-fixed-asset-dialog/dispose-fixed-asset-dialog.component';
import { FixedAssetDialogComponent } from '../fixed-asset-dialog/fixed-asset-dialog.component';
import { FixedAssetDetailComponent } from './fixed-asset-detail.component';

type Internals = {
  ngOnInit(): void;
  detail(): FixedAssetDetail | null;
  notFound(): boolean;
  canDispose(): boolean;
  scheduleRows(): { posted: boolean; stateLabel: string }[];
  edit(): void;
  dispose(): void;
};

const url = `${environment.apiUrl}/accounting/fixed-assets/5`;
function detail(overrides: Partial<FixedAssetDetail> = {}, status: 'Active' | 'Disposed' = 'Active'): FixedAssetDetail {
  return {
    asset: { id: 5, bookId: 1, name: 'CNC Mill', assetTag: 'FA-001', cost: 1200, salvageValue: 0, inServiceDate: '2026-01-01', usefulLifeMonths: 12, monthlyDepreciation: 100, accumulatedDepreciation: 100, netBookValue: 1100, status, method: 'StraightLine', linkedAssetId: null, usefulLifeUnits: null },
    assetGlAccountId: 150, accumulatedDepreciationGlAccountId: 151, depreciationExpenseGlAccountId: 600, isEditable: false,
    schedule: [
      { periodMonth: '2026-01-01', amount: 100, accumulatedDepreciation: 100, netBookValue: 1100, posted: true, journalEntryId: 41 },
      { periodMonth: '2026-02-01', amount: 100, accumulatedDepreciation: 200, netBookValue: 1000, posted: false, journalEntryId: null },
    ],
    ...overrides,
  };
}

describe('FixedAssetDetailComponent', () => {
  let http: HttpTestingController;
  let id: string;
  const dialog = { open: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    id = '5';
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
        { provide: MatDialog, useValue: dialog },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: { get paramMap() { return of(convertToParamMap({ id })); } } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function create(): Internals {
    const c = TestBed.runInInjectionContext(() => new FixedAssetDetailComponent()) as unknown as Internals;
    c.ngOnInit();
    return c;
  }

  it('loads the asset and labels posted and projected months', () => {
    const c = create();
    http.expectOne(url).flush(detail());

    expect(c.scheduleRows().map((r) => r.stateLabel)).toEqual(['accounting.fixedAssets.posted', 'accounting.fixedAssets.projected']);
    expect(c.canDispose()).toBe(true);
  });

  it('offers edit only while no depreciation has posted', () => {
    const c = create();
    http.expectOne(url).flush(detail());

    c.edit();
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('opens the editor and reloads after a save when editable', () => {
    const c = create();
    http.expectOne(url).flush(detail({ isEditable: true }));
    dialog.open.mockReturnValue({ afterClosed: () => of({ asset: { id: 5 } }) });

    c.edit();

    expect(dialog.open).toHaveBeenCalledWith(FixedAssetDialogComponent, expect.anything());
    http.expectOne(url).flush(detail({ isEditable: true }));
  });

  it('opens the disposal dialog and reloads after disposal', () => {
    const c = create();
    http.expectOne(url).flush(detail());
    dialog.open.mockReturnValue({ afterClosed: () => of({ gainLoss: 0 }) });

    c.dispose();

    expect(dialog.open).toHaveBeenCalledWith(DisposeFixedAssetDialogComponent, expect.anything());
    http.expectOne(url).flush(detail({}, 'Disposed'));
    expect(c.canDispose()).toBe(false);
  });

  it('reports a bad id as not found without calling the API', () => {
    id = 'abc';
    const c = create();

    expect(c.notFound()).toBe(true);
    http.expectNone(url);
  });
});
