import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, map, of } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { FixedAsset } from '../../models/fixed-asset.model';
import { DepreciationRunDialogComponent } from '../depreciation-run-dialog/depreciation-run-dialog.component';
import { FixedAssetDialogComponent } from '../fixed-asset-dialog/fixed-asset-dialog.component';
import { FixedAssetsComponent } from './fixed-assets.component';

type Internals = {
  ngOnInit(): void;
  rows(): FixedAsset[];
  totals(): { cost: number; accumulated: number; netBookValue: number };
  open(row: unknown): void;
  register(): void;
  runDepreciation(): void;
};

const ASSETS: FixedAsset[] = [
  { id: 1, bookId: 1, name: 'CNC Mill', assetTag: 'FA-001', cost: 1200, salvageValue: 0, inServiceDate: '2026-01-01', usefulLifeMonths: 12, monthlyDepreciation: 100, accumulatedDepreciation: 300, netBookValue: 900, status: 'Active', method: 'StraightLine', linkedAssetId: null, usefulLifeUnits: null },
  { id: 2, bookId: 1, name: 'Mold A', assetTag: 'FA-002', cost: 5000, salvageValue: 0, inServiceDate: '2026-02-01', usefulLifeMonths: 60, monthlyDepreciation: 0, accumulatedDepreciation: 0, netBookValue: 5000, status: 'Active', method: 'UnitsOfProduction', linkedAssetId: 7, usefulLifeUnits: 100000 },
  { id: 3, bookId: 1, name: 'Old truck', assetTag: null, cost: 800, salvageValue: 0, inServiceDate: '2020-01-01', usefulLifeMonths: 24, monthlyDepreciation: 0, accumulatedDepreciation: 800, netBookValue: 0, status: 'Disposed', method: 'StraightLine', linkedAssetId: null, usefulLifeUnits: null },
];

describe('FixedAssetsComponent', () => {
  let http: HttpTestingController;
  let query: BehaviorSubject<Record<string, string>>;
  const router = { navigate: vi.fn() };
  const dialog = { open: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    query = new BehaviorSubject<Record<string, string>>({});
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
        { provide: MatDialog, useValue: dialog },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: query.pipe(map((q) => convertToParamMap(q))),
            snapshot: { get queryParamMap() { return convertToParamMap(query.value); } },
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function create(): Internals {
    const c = TestBed.runInInjectionContext(() => new FixedAssetsComponent()) as unknown as Internals;
    c.ngOnInit();
    http.expectOne(`${environment.apiUrl}/accounting/fixed-assets?bookId=1`).flush(ASSETS);
    return c;
  }

  it('lists the register with totals', () => {
    const c = create();

    expect(c.rows().map((r) => r.id)).toEqual([1, 2, 3]);
    expect(c.totals()).toEqual({ cost: 7000, accumulated: 1100, netBookValue: 5900 });
  });

  it('filters by status, method and text from the URL', () => {
    query.next({ status: 'Active', method: 'UnitsOfProduction' });
    const c = TestBed.runInInjectionContext(() => new FixedAssetsComponent()) as unknown as Internals;
    c.ngOnInit();
    http.expectOne(`${environment.apiUrl}/accounting/fixed-assets?bookId=1`).flush(ASSETS);

    expect(c.rows().map((r) => r.id)).toEqual([2]);
  });

  it('opens the asset detail on a row click', () => {
    const c = create();

    c.open(ASSETS[0]);

    expect(router.navigate).toHaveBeenCalledWith(['/accounting/fixed-assets', 1]);
  });

  it('reloads after registering an asset', () => {
    const c = create();
    dialog.open.mockReturnValue({ afterClosed: () => of({ id: 4 }) });

    c.register();

    expect(dialog.open).toHaveBeenCalledWith(FixedAssetDialogComponent, expect.objectContaining({ data: { bookId: 1 } }));
    http.expectOne(`${environment.apiUrl}/accounting/fixed-assets?bookId=1`).flush(ASSETS);
  });

  it('reloads only when the depreciation run posted', () => {
    const c = create();
    dialog.open.mockReturnValueOnce({ afterClosed: () => of(false) });
    c.runDepreciation();
    http.expectNone(`${environment.apiUrl}/accounting/fixed-assets?bookId=1`);

    dialog.open.mockReturnValueOnce({ afterClosed: () => of(true) });
    c.runDepreciation();

    expect(dialog.open).toHaveBeenCalledWith(DepreciationRunDialogComponent, expect.anything());
    http.expectOne(`${environment.apiUrl}/accounting/fixed-assets?bookId=1`).flush(ASSETS);
  });
});
