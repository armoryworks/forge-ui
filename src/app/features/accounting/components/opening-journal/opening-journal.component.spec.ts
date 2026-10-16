import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FormArray, FormGroup } from '@angular/forms';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../../../shared/services/auth.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { GlAccount } from '../../models/accounting.models';
import { ConversionStatus } from '../../models/conversion-status.model';
import { OpeningJournalComponent } from './opening-journal.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

type Internals = {
  ngOnInit(): void;
  status(): ConversionStatus | null;
  tieOut(): unknown;
  openingDateLabel(): string;
  form: FormGroup;
  lines: FormArray<FormGroup>;
  csvControl: { setValue(v: string): void };
  loadCsv(): void;
  post(): void;
};

const base = `${environment.apiUrl}/accounting/conversion`;

function status(overrides: Partial<ConversionStatus> = {}): ConversionStatus {
  return {
    bookId: 1, bookName: 'Main', functionalCurrencyId: 3, openingJournalPosted: false,
    openingEntryId: null, openingEntryNumber: null, openingEntryDate: null, fullGlEnabled: false,
    ...overrides,
  };
}

function account(id: number, accountNumber: string, name: string): GlAccount {
  return {
    id, accountNumber, name, accountType: 'Asset', normalBalance: 'Debit',
    isPostable: true, isControlAccount: false, requiresJob: false, requiresCostCenter: false,
  };
}

describe('OpeningJournalComponent', () => {
  let http: HttpTestingController;
  let snackbar: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; errorFrom: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    snackbar = { success: vi.fn(), error: vi.fn(), errorFrom: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
        { provide: AuthService, useValue: { hasAnyRole: () => false } },
        { provide: SnackbarService, useValue: snackbar },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function open(initial = status()): Internals {
    const c = TestBed.runInInjectionContext(() => new OpeningJournalComponent()) as unknown as Internals;
    c.ngOnInit();
    http.expectOne(`${base}/status`).flush(initial);
    if (initial.openingJournalPosted) {
      http.expectOne((r) => r.url === `${base}/tie-out`).flush({ bookId: 1, rows: [], totalDebit: 0, totalCredit: 0, isBalanced: true });
    }
    http.expectOne((r) => r.url === `${base}/accounts` && r.params.get('bookId') === '1')
      .flush([account(11, '10100', 'Cash'), account(12, '11000', 'Receivables'), account(30, '30000', 'Equity')]);
    return c;
  }

  it('loads the CSV rows onto the lines, resolving account numbers', () => {
    const c = open();
    c.csvControl.setValue('accountNumber,debit,credit,description\n10100,7000,0,Cash\n11000,3000,0,\n30000,0,10000,Opening equity');

    c.loadCsv();

    expect(c.lines.length).toBe(3);
    expect(c.lines.getRawValue()).toEqual([
      { glAccountId: 11, debit: 7000, credit: null, description: 'Cash' },
      { glAccountId: 12, debit: 3000, credit: null, description: '' },
      { glAccountId: 30, debit: null, credit: 10000, description: 'Opening equity' },
    ]);
  });

  it('refuses CSV rows whose account the book does not have', () => {
    const c = open();
    c.csvControl.setValue('10100,100,0\n99999,0,100');

    c.loadCsv();

    expect(snackbar.error).toHaveBeenCalled();
    expect(c.lines.getRawValue().every((l) => l['glAccountId'] === null)).toBe(true);
  });

  it('posts the balanced journal by account number in the book currency, then shows it posted', () => {
    const c = open();
    c.form.controls['asOfDate'].setValue(new Date(2026, 0, 1));
    c.lines.at(0).patchValue({ glAccountId: 11, debit: 10000 });
    c.lines.at(1).patchValue({ glAccountId: 30, credit: 10000 });
    expect(c.form.valid).toBe(true);

    c.post();

    const req = http.expectOne(`${base}/opening-journal`);
    expect(req.request.body).toEqual({
      bookId: 1,
      currencyId: 3,
      asOfDate: '2026-01-01',
      lines: [
        { accountNumber: '10100', debit: 10000, credit: 0, description: null },
        { accountNumber: '30000', debit: 0, credit: 10000, description: null },
      ],
    });
    req.flush({ id: 5, bookId: 1, entryNumber: 1, entryDate: '2026-01-01', status: 'Posted', memo: null });
    http.expectOne((r) => r.url === `${base}/status` && r.params.get('bookId') === '1')
      .flush(status({ openingJournalPosted: true, openingEntryId: 5, openingEntryNumber: 1, openingEntryDate: '2026-01-01' }));
    http.expectOne((r) => r.url === `${base}/tie-out` && r.params.get('asOfDate') === '2026-01-01')
      .flush({ bookId: 1, rows: [], totalDebit: 10000, totalCredit: 10000, isBalanced: true });

    expect(c.status()?.openingJournalPosted).toBe(true);
    expect(c.openingDateLabel()).toBe('01/01/2026');
    expect(c.tieOut()).not.toBeNull();
  });

  it('keeps an unbalanced journal from posting', () => {
    const c = open();
    c.form.controls['asOfDate'].setValue(new Date(2026, 0, 1));
    c.lines.at(0).patchValue({ glAccountId: 11, debit: 10000 });
    c.lines.at(1).patchValue({ glAccountId: 30, credit: 9000 });

    c.post();

    expect(c.form.valid).toBe(false);
    http.expectNone(`${base}/opening-journal`);
  });

  it('shows the tie-out straight away for a book already converted', () => {
    const c = open(status({ openingJournalPosted: true, openingEntryId: 5, openingEntryNumber: 1, openingEntryDate: '2026-01-01' }));

    expect(c.tieOut()).not.toBeNull();
  });
});
