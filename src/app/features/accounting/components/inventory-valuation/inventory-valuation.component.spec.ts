import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { InventoryValuationComponent } from './inventory-valuation.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

type Internals = {
  ngOnInit(): void;
  loading(): boolean;
  parts(): { id: number; partNumber: string }[];
  reconcilingItems(): { id: number; amount: number }[];
};

const base = `${environment.apiUrl}/accounting`;

describe('InventoryValuationComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ bookId: '2' }) } } },
        { provide: SnackbarService, useValue: { errorFrom: vi.fn() } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the per-part valuation and the GL tie-out for the book', () => {
    const c = TestBed.runInInjectionContext(() => new InventoryValuationComponent()) as unknown as Internals;
    c.ngOnInit();

    http.expectOne((r) => r.url === `${base}/inventory-valuation` && r.params.get('bookId') === '2')
      .flush([{ partId: 3, partNumber: 'FG-310', onHandQuantity: 200, averageUnitCost: 471, totalValue: 94200 }]);
    http.expectOne((r) => r.url === `${base}/inventory-valuation/reconciliation` && r.params.get('bookId') === '2')
      .flush({
        bookId: 2, storeValue: 94200, glInventoryBalance: 227100, glWorkInProcessBalance: 0, glStockedBalance: 227100,
        variance: -132900, isReconciled: false, roundingTolerance: 0.01,
        accounts: [{ accountNumber: '13100', accountName: 'Raw', storeValue: 0, glBalance: 132900, variance: -132900 }],
        reconcilingItems: [{ kind: 'PostedOutsideStore', accountNumber: '13100', sourceType: 'OpeningJournal', amount: -132900, description: 'x' }],
      });

    expect(c.loading()).toBe(false);
    expect(c.parts()).toEqual([expect.objectContaining({ id: 3, partNumber: 'FG-310' })]);
    expect(c.reconcilingItems()).toEqual([expect.objectContaining({ id: 1, amount: -132900 })]);
  });
});
