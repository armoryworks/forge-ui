import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { ManualJournalEntryResult } from '../../models/accounting.models';
import { JournalApprovalsComponent } from './journal-approvals.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

type Internals = {
  ngOnInit(): void;
  entries(): { entry: ManualJournalEntryResult; dateLabel: string; total: number; ownEntry: boolean; lines: { account: string }[] }[];
  approve(entry: ManualJournalEntryResult): void;
  reject(entry: ManualJournalEntryResult): void;
};

const base = `${environment.apiUrl}/accounting`;

function pending(id: number, entryNumber: number, postedBy = 3): ManualJournalEntryResult {
  return {
    id, bookId: 1, entryNumber, entryDate: '2026-10-31', status: 'PendingApproval', memo: 'Accrue utilities', postedBy,
    lines: [
      { id: id * 10 + 1, lineNumber: 1, glAccountId: 60, debit: 125000, credit: 0, functionalAmount: 125000, description: null },
      { id: id * 10 + 2, lineNumber: 2, glAccountId: 21, debit: 0, credit: 125000, functionalAmount: -125000, description: null },
    ],
  };
}

describe('JournalApprovalsComponent', () => {
  let http: HttpTestingController;
  let dialogResult: string | undefined;

  beforeEach(() => {
    dialogResult = undefined;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(dialogResult) }) } },
        { provide: AuthService, useValue: { user: () => ({ id: 5 }) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function open(): Internals {
    const c = TestBed.runInInjectionContext(() => new JournalApprovalsComponent()) as unknown as Internals;
    c.ngOnInit();
    http.expectOne((r) => r.url === `${base}/accounts`).flush([
      { id: 60, accountNumber: '61000', name: 'Utilities' },
      { id: 21, accountNumber: '21000', name: 'Accrued liabilities' },
    ]);
    http.expectOne((r) => r.url === `${base}/journal-entries/pending` && r.params.get('bookId') === '1')
      .flush([pending(7, 42), pending(8, 43)]);
    return c;
  }

  it('lists pending entries with account names, totals and US dates', () => {
    const c = open();

    const first = c.entries()[0];
    expect(first.dateLabel).toBe('10/31/2026');
    expect(first.total).toBe(125000);
    expect(first.lines.map((l) => l.account)).toEqual(['61000 — Utilities', '21000 — Accrued liabilities']);
  });

  it('marks the signed-in user\'s own entries so they are not offered for approval', () => {
    const c = TestBed.runInInjectionContext(() => new JournalApprovalsComponent()) as unknown as Internals;
    c.ngOnInit();
    http.expectOne((r) => r.url === `${base}/accounts`).flush([]);
    http.expectOne((r) => r.url === `${base}/journal-entries/pending`).flush([pending(7, 42, 5), pending(8, 43, 3)]);

    expect(c.entries().map((e) => e.ownEntry)).toEqual([true, false]);
  });

  it('approves an entry and drops it from the list', () => {
    const c = open();

    c.approve(c.entries()[0].entry);
    http.expectOne(`${base}/journal-entries/7/approve`).flush({ ...pending(7, 42), status: 'Posted' });

    expect(c.entries().map((e) => e.entry.id)).toEqual([8]);
  });

  it('rejects with the reason given, and does nothing when the dialog is cancelled', () => {
    const c = open();

    c.reject(c.entries()[1].entry);
    http.expectNone(`${base}/journal-entries/8/reject`);

    dialogResult = 'Wrong period';
    c.reject(c.entries()[1].entry);
    const req = http.expectOne((r) => r.url === `${base}/journal-entries/8/reject`);
    expect(req.request.params.get('reason')).toBe('Wrong period');
    req.flush({ ...pending(8, 43), status: 'Draft' });

    expect(c.entries().map((e) => e.entry.id)).toEqual([7]);
  });
});
