import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { GeneralLedgerService } from './general-ledger.service';
import { environment } from '../../../../environments/environment';

describe('GeneralLedgerService', () => {
  let service: GeneralLedgerService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/accounting`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GeneralLedgerService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('requests the trial balance with the book id', () => {
    service.getTrialBalance(1).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${base}/trial-balance`);
    expect(req.request.params.get('bookId')).toBe('1');
    req.flush({});
  });

  it('passes a date range to the P&L', () => {
    service.getProfitAndLoss(1, '2026-01-01', '2026-12-31').subscribe();
    const req = httpMock.expectOne((r) => r.url === `${base}/pnl`);
    expect(req.request.params.get('fromDate')).toBe('2026-01-01');
    expect(req.request.params.get('toDate')).toBe('2026-12-31');
    req.flush({});
  });

  it('maps the period status to its close verb', () => {
    service.setPeriodStatus(5, 'SoftClosed').subscribe();
    const req = httpMock.expectOne(`${base}/periods/5/soft-close`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('finalizes a bank reconciliation', () => {
    service.finalizeBankReconciliation(9).subscribe();
    const req = httpMock.expectOne(`${base}/bank-reconciliations/9/finalize`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('toggles a bank-reconciliation item cleared flag via query param', () => {
    service.setBankReconciliationItemCleared(3, 42, true).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${base}/bank-reconciliations/3/items/42/cleared`);
    expect(req.request.method).toBe('POST');
    expect(req.request.params.get('cleared')).toBe('true');
    req.flush({});
  });

  it('requests the ledger register with only the book id by default', () => {
    service.getLedgerRegister(1).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${base}/ledger`);
    expect(req.request.params.get('bookId')).toBe('1');
    expect(req.request.params.has('status')).toBe(false);
    req.flush({ data: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
  });

  it('passes ledger register filters as query params', () => {
    service.getLedgerRegister(1, { status: 'Posted', glAccountId: 102, page: 2, pageSize: 50 }).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${base}/ledger`);
    expect(req.request.params.get('status')).toBe('Posted');
    expect(req.request.params.get('glAccountId')).toBe('102');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('50');
    req.flush({ data: [], page: 2, pageSize: 50, totalCount: 0, totalPages: 0 });
  });

  it('requests a journal-entry AI explanation by entry id + book', () => {
    service.explainJournalEntry(1, 5001).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${base}/journal-entries/5001/explain`);
    expect(req.request.params.get('bookId')).toBe('1');
    req.flush({ entryId: 5001, explanation: 'x', aiAvailable: true, deterministicSummary: 'x' });
  });

  it('requests the chart of accounts (all accounts by default)', () => {
    service.getChartOfAccounts(1).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${base}/accounts`);
    expect(req.request.params.get('bookId')).toBe('1');
    expect(req.request.params.has('postableOnly')).toBe(false);
    req.flush([]);
  });

  it('narrows the chart of accounts to postable when asked', () => {
    service.getChartOfAccounts(1, true).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${base}/accounts`);
    expect(req.request.params.get('postableOnly')).toBe('true');
    req.flush([]);
  });

  it('posts a manual journal entry to the create endpoint', () => {
    service
      .createManualJournalEntry({
        bookId: 1,
        entryDate: '2026-01-10',
        currencyId: 1,
        memo: 'cash sale',
        lines: [
          { glAccountId: 100, debit: 100, credit: 0 },
          { glAccountId: 101, debit: 0, credit: 100 },
        ],
      })
      .subscribe();
    const req = httpMock.expectOne((r) => r.url === `${base}/journal-entries`);
    expect(req.request.method).toBe('POST');
    expect((req.request.body as { lines: unknown[] }).lines).toHaveLength(2);
    req.flush({ id: 5, bookId: 1, entryNumber: 1, entryDate: '2026-01-10', status: 'Posted', memo: 'cash sale' });
  });

  it('requests the anomaly scan with the threshold', () => {
    service.getGlAnomalies(1, { largeManualThreshold: 5000 }).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${base}/anomalies`);
    expect(req.request.params.get('bookId')).toBe('1');
    expect(req.request.params.get('largeManualThreshold')).toBe('5000');
    req.flush([]);
  });
});
