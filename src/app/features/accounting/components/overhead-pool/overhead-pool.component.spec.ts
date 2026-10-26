import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { OverheadPoolCloseResult } from '../../models/overhead-pool-close.model';
import { OverheadPoolStatus } from '../../models/overhead-pool-status.model';
import { OverheadPoolComponent } from './overhead-pool.component';

type Internals = {
  ngOnInit(): void;
  status(): OverheadPoolStatus | null;
  canClose(): boolean;
  closeResult(): OverheadPoolCloseResult | null;
  varianceRows(): { key: string; direction: string }[];
  recordForm: FormGroup;
  record(): void;
  confirmClose(): void;
};

const api = `${environment.apiUrl}/accounting`;
const OPEN: OverheadPoolStatus = {
  asOf: '2026-03-31', actualOverhead: 1500, appliedOverhead: 1100, variance: 400, closedOnDate: false, lastClosedOn: null, isConfigured: true,
};
const VARIANCES = {
  bookId: 1, from: '2026-03-01', to: '2026-03-31', total: -50,
  lines: [
    { key: 'OVERHEAD_SPENDING_VARIANCE', name: 'Overhead spending', amount: 0, isFavorable: false },
    { key: 'PURCHASE_PRICE_VARIANCE', name: 'Purchase price', amount: -50, isFavorable: true },
  ],
};

describe('OverheadPoolComponent', () => {
  let http: HttpTestingController;
  const dialog = { open: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
        { provide: MatDialog, useValue: dialog },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ asOf: '2026-03-31' }) } } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function flushLoad(status: OverheadPoolStatus = OPEN): void {
    http.expectOne(`${api}/overhead/status?asOf=2026-03-31`).flush(status);
    http.expectOne(`${api}/variances?from=2026-03-01&to=2026-03-31`).flush(VARIANCES);
  }

  function create(status: OverheadPoolStatus = OPEN): Internals {
    const c = TestBed.runInInjectionContext(() => new OverheadPoolComponent()) as unknown as Internals;
    c.ngOnInit();
    http.expectOne((r) => r.url === `${api}/accounts`).flush([]);
    flushLoad(status);
    return c;
  }

  it('loads the pool and the month variances for the date in the URL', () => {
    const c = create();

    expect(c.status()?.variance).toBe(400);
    expect(c.canClose()).toBe(true);
    expect(c.varianceRows().map((r) => r.direction)).toEqual(['—', 'accounting.overhead.favorable']);
  });

  it('records actual overhead against the chosen source account and reloads', () => {
    const c = create();
    c.recordForm.patchValue({ amount: 250, sourceGlAccountId: 640, memo: ' utilities ' });

    c.record();

    const req = http.expectOne(`${api}/overhead/record`);
    expect(req.request.body).toEqual({ amount: 250, entryDate: '2026-03-31', sourceGlAccountId: 640, memo: 'utilities' });
    req.flush(null);
    flushLoad();
    expect(c.recordForm.get('amount')!.value).toBeNull();
  });

  it('closes the period after confirmation and shows the variance posted', () => {
    const c = create();
    dialog.open.mockReturnValue({ afterClosed: () => of(true) });

    c.confirmClose();

    const req = http.expectOne(`${api}/overhead/close`);
    expect(req.request.body).toEqual({ asOf: '2026-03-31' });
    req.flush({ actualOverhead: 1500, appliedOverhead: 1100, spendingVariance: 400, posted: true });
    flushLoad({ ...OPEN, actualOverhead: 0, appliedOverhead: 0, variance: 0, closedOnDate: true, lastClosedOn: '2026-03-31' });
    expect(c.closeResult()?.spendingVariance).toBe(400);
    expect(c.canClose()).toBe(false);
  });

  it('does not offer the close again for a date already closed', () => {
    const c = create({ ...OPEN, closedOnDate: true });

    c.confirmClose();

    expect(dialog.open).not.toHaveBeenCalled();
    http.expectNone(`${api}/overhead/close`);
  });
});
