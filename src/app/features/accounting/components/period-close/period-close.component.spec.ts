import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { AccountingHubService } from '../../../../shared/services/accounting-hub.service';
import { CloseChecklistItem, CloseChecklistResult, FiscalPeriodModel, FiscalYearModel } from '../../models/accounting.models';
import { PeriodCloseComponent } from './period-close.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

type Internals = {
  ngOnInit(): void;
  checklists(): Record<number, { periodId: number; periodName: string; result: CloseChecklistResult }>;
  showChecklist(fiscalYearId: number, period: FiscalPeriodModel): void;
  checklistLabel(item: CloseChecklistItem): string;
};

const base = `${environment.apiUrl}/accounting`;

function period(id: number, n: number, name: string, start: string, end: string): FiscalPeriodModel {
  return { id, fiscalYearId: 10, periodNumber: n, name, startDate: start, endDate: end, status: 'Open' };
}

const year: FiscalYearModel = {
  id: 10, name: '2026', startDate: '2026-01-01', endDate: '2026-12-31', status: 'Open',
  periods: [
    period(110, 10, 'Oct 2026', '2026-10-01', '2026-10-31'),
    period(112, 12, 'Dec 2026', '2026-12-01', '2026-12-31'),
    period(111, 11, 'Nov 2026', '2026-11-01', '2026-11-30'),
  ],
};

function checklist(asOf: string, arPassed: boolean): CloseChecklistResult {
  return {
    bookId: 1, asOf, allPassed: arPassed,
    items: [
      { key: 'GRNI_RECONCILED', label: 'GRNI ties (GL vs received-not-billed)', passed: true, detail: 'Reconciled' },
      { key: 'AR_TIES', label: 'AR aging ties to control', passed: arPassed, detail: arPassed ? 'Reconciled' : 'Difference 186499.99' },
    ],
  };
}

describe('PeriodCloseComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: AccountingHubService, useValue: { subscribe: () => () => undefined } },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(false) }) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function open(): Internals {
    const c = TestBed.runInInjectionContext(() => new PeriodCloseComponent()) as unknown as Internals;
    c.ngOnInit();
    http.expectOne((r) => r.url === `${base}/fiscal-calendar` && r.params.get('bookId') === '1').flush([year]);
    return c;
  }

  it('loads the close checklist of the year\'s final period, which is what the year close is judged by', () => {
    const c = open();

    http.expectOne(`${base}/periods/112/close-checklist`).flush(checklist('2026-12-31', false));

    const shown = c.checklists()[10];
    expect(shown.periodName).toBe('Dec 2026');
    expect(shown.result.allPassed).toBe(false);
    expect(shown.result.items.find((i) => !i.passed)?.detail).toBe('Difference 186499.99');
  });

  it('shows the checklist of a period the Controller asks about', () => {
    const c = open();
    http.expectOne(`${base}/periods/112/close-checklist`).flush(checklist('2026-12-31', false));

    c.showChecklist(10, year.periods[0]);
    http.expectOne(`${base}/periods/110/close-checklist`).flush(checklist('2026-10-31', true));

    expect(c.checklists()[10].periodId).toBe(110);
    expect(c.checklists()[10].result.allPassed).toBe(true);
  });

  it('labels known checklist items through i18n and falls back to the server label', () => {
    const c = open();
    http.expectOne(`${base}/periods/112/close-checklist`).flush(checklist('2026-12-31', true));

    expect(c.checklistLabel({ key: 'AR_TIES', label: 'x', passed: true, detail: '' })).toBe('accounting.periodClose.checklist.arTies');
    expect(c.checklistLabel({ key: 'NEW_ITEM', label: 'Server label', passed: true, detail: '' })).toBe('Server label');
  });
});
