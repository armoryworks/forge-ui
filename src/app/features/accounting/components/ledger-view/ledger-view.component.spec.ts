import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { LedgerViewComponent } from './ledger-view.component';
import { GeneralLedgerService } from '../../services/general-ledger.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AuthService } from '../../../../shared/services/auth.service';
import {
  JournalEntryExplanation,
  LedgerRegisterEntry,
  LedgerRegisterPage,
} from '../../models/accounting.models';

const ENTRY: LedgerRegisterEntry = {
  id: 1,
  entryNumber: 1,
  entryDate: '2026-01-10',
  source: 'Manual',
  sourceType: null,
  sourceId: null,
  status: 'Posted',
  memo: 'first',
  reversalOfEntryId: null,
  reversedByEntryId: null,
  postedAt: null,
  lines: [],
};

const PAGE: LedgerRegisterPage = { data: [ENTRY], page: 1, pageSize: 100, totalCount: 1, totalPages: 1 };

interface ExplainState {
  loading: boolean;
  result: JournalEntryExplanation | null;
  failed: boolean;
}

interface LedgerApi {
  ngOnInit(): void;
  loading(): boolean;
  error(): string | null;
  entries(): (LedgerRegisterEntry & {
    entryDateDisplay: string; total: number; accounts: string; lensDebit?: number; lensCredit?: number; balanceAfter?: number;
  })[];
  columns(): { field: string }[];
  unloadedCount(): number;
  explanations(): Record<number, ExplainState>;
  explain(entry: LedgerRegisterEntry): void;
  scanAnomalies(): void;
  scanning(): boolean;
  anomalyFlags(): Record<number, string[]>;
  anomalyCount(): number;
  reverseEntry(entry: LedgerRegisterEntry): void;
  lensAccount(): unknown;
  accountNotFound(): boolean;
  toggleDrafts(): void;
  toggleFlaggedOnly(): void;
  canResubmit(entry: LedgerRegisterEntry): boolean;
}

describe('LedgerViewComponent', () => {
  const gl = {
    getLedgerRegister: vi.fn(),
    explainJournalEntry: vi.fn(),
    getGlAnomalies: vi.fn(),
    reverseJournalEntry: vi.fn(),
    getTrialBalance: vi.fn(),
    getChartOfAccounts: vi.fn(),
  };
  const snackbar = { error: vi.fn(), errorFrom: vi.fn(), success: vi.fn() };
  const dialog = { open: vi.fn() };
  let routeParams: Record<string, string>;

  function create(): LedgerApi {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: GeneralLedgerService, useValue: gl },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap(routeParams)), snapshot: { queryParamMap: convertToParamMap({}) } } },
        { provide: SnackbarService, useValue: snackbar },
        { provide: MatDialog, useValue: dialog },
        { provide: AuthService, useValue: { user: () => ({ id: 5 }) } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    // Empty the template so the heavy child components (data-table, etc.) don't render — we're
    // exercising the component's data/advisory logic, not its markup.
    TestBed.overrideComponent(LedgerViewComponent, { set: { template: '', imports: [], styles: [] } });
    const component = TestBed.createComponent(LedgerViewComponent).componentInstance as unknown as LedgerApi;
    component.ngOnInit();
    return component;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    routeParams = {};
    gl.getLedgerRegister.mockReturnValue(of(PAGE));
    gl.getTrialBalance.mockReturnValue(of({ bookId: 1, rows: [], totalDebit: 0, totalCredit: 0, isBalanced: true }));
    gl.getChartOfAccounts.mockReturnValue(of([]));
    gl.explainJournalEntry.mockReturnValue(
      of<JournalEntryExplanation>({ entryId: 1, explanation: 'A $100 cash sale.', aiAvailable: true, deterministicSummary: 'd' }),
    );
    gl.getGlAnomalies.mockReturnValue(of([]));
    gl.reverseJournalEntry.mockReturnValue(
      of({ id: 99, bookId: 1, entryNumber: 12, entryDate: '2026-02-01', status: 'Posted', memo: 'r' }),
    );
    dialog.open.mockReturnValue({ afterClosed: () => of({ reversalDate: '2026-02-01', reason: 'wrong account' }) });
  });

  it('loads the register for the default book on init', () => {
    const api = create();
    expect(gl.getLedgerRegister).toHaveBeenCalledWith(1, { pageSize: 100, glAccountId: null, status: null });
    expect(api.entries()).toHaveLength(1);
    expect(api.loading()).toBe(false);
    expect(api.error()).toBeNull();
  });

  it('shows a not-found state for an invalid account id instead of the whole register', () => {
    routeParams = { accountId: 'abc' };
    const api = create();
    expect(api.accountNotFound()).toBe(true);
    expect(gl.getLedgerRegister).not.toHaveBeenCalled();
    expect(api.entries()).toHaveLength(0);
  });

  it('shows the not-found state for a well-formed account id the book does not have', () => {
    routeParams = { accountId: '999' };
    const api = create();
    expect(gl.getChartOfAccounts).toHaveBeenCalledWith(1);
    expect(api.accountNotFound()).toBe(true);
    expect(api.lensAccount()).toBeNull();
    expect(api.entries()).toHaveLength(0);
    expect(api.loading()).toBe(false);
  });

  it('lenses an account with no postings at a zero balance rather than not-found', () => {
    routeParams = { accountId: '7' };
    gl.getLedgerRegister.mockReturnValue(of({ data: [], page: 1, pageSize: 100, totalCount: 0, totalPages: 0 }));
    gl.getChartOfAccounts.mockReturnValue(of([{
      id: 7, accountNumber: '60100', name: 'Supplies', accountType: 'Expense', normalBalance: 'Debit',
      isPostable: true, isControlAccount: false, requiresJob: false, requiresCostCenter: false,
    }]));
    const api = create();
    expect(api.accountNotFound()).toBe(false);
    expect(api.lensAccount()).toMatchObject({ glAccountId: 7, accountNumber: '60100', accountName: 'Supplies', netBalance: 0 });
  });

  it('lists rejected drafts on request and offers resubmit only on the signed-in user\'s own', () => {
    const api = create();
    api.toggleDrafts();
    expect(gl.getLedgerRegister).toHaveBeenLastCalledWith(1, { pageSize: 100, glAccountId: null, status: 'Draft' });

    expect(api.canResubmit({ ...ENTRY, status: 'Draft', postedBy: 5 })).toBe(true);
    expect(api.canResubmit({ ...ENTRY, status: 'Draft', postedBy: 6 })).toBe(false);
    expect(api.canResubmit({ ...ENTRY, status: 'Posted', postedBy: 5 })).toBe(false);
  });

  it('narrows the register to flagged entries', () => {
    gl.getLedgerRegister.mockReturnValue(of({ ...PAGE, data: [ENTRY, { ...ENTRY, id: 2, entryNumber: 2 }], totalCount: 2 }));
    gl.getGlAnomalies.mockReturnValue(
      of([{ entryId: 2, entryNumber: 2, entryDate: '2026-01-10', source: 'Manual', totalDebit: 100, flags: ['big'] }]),
    );
    const api = create();
    api.scanAnomalies();
    api.toggleFlaggedOnly();
    expect(api.entries().map((e) => e.id)).toEqual([2]);
  });

  it('formats the DateOnly entry date as a plain string (no timezone shift)', () => {
    const api = create();
    // "2026-01-10" must render 01/10/2026 — never TZ-shifted to the previous day.
    expect(api.entries()[0].entryDateDisplay).toBe('01/10/2026');
  });

  it('scans for anomalies and indexes the flags by entry', () => {
    gl.getGlAnomalies.mockReturnValue(
      of([{ entryId: 1, entryNumber: 1, entryDate: '2026-01-10', source: 'Manual', totalDebit: 100, flags: ['big'] }]),
    );
    const api = create();
    api.scanAnomalies();
    expect(gl.getGlAnomalies).toHaveBeenCalledWith(1);
    expect(api.anomalyCount()).toBe(1);
    expect(api.anomalyFlags()[1]).toEqual(['big']);
  });

  it('computes the running balance in the account lens, newest first', () => {
    routeParams = { accountId: '1' };
    const cashLine = (id: number, debit: number, credit: number) => ({
      id, lineNumber: 1, glAccountId: 1, accountNumber: '10100', accountName: 'Cash',
      debit, credit, description: null, jobId: null, costCenterId: null,
    });
    const otherLine = (id: number) => ({
      id, lineNumber: 2, glAccountId: 23, accountNumber: '40000', accountName: 'Revenue',
      debit: 0, credit: 0, description: null, jobId: null, costCenterId: null,
    });
    // newest first: +100 (entry 3), -30 (entry 2), +50 (entry 1); current balance = 120
    gl.getLedgerRegister.mockReturnValue(of({
      data: [
        { ...ENTRY, id: 3, entryNumber: 3, lines: [cashLine(31, 100, 0), otherLine(32)] },
        { ...ENTRY, id: 2, entryNumber: 2, lines: [cashLine(21, 0, 30), otherLine(22)] },
        { ...ENTRY, id: 1, entryNumber: 1, lines: [cashLine(11, 50, 0), otherLine(12)] },
      ],
      page: 1, pageSize: 100, totalCount: 3, totalPages: 1,
    }));
    gl.getTrialBalance.mockReturnValue(of({
      bookId: 1, totalDebit: 0, totalCredit: 0, isBalanced: true,
      rows: [{ glAccountId: 1, accountNumber: '10100', accountName: 'Cash', debitTotal: 150, creditTotal: 30, netBalance: 120 }],
    }));

    const api = create();
    expect(gl.getLedgerRegister).toHaveBeenCalledWith(1, { pageSize: 100, glAccountId: 1, status: null });
    expect(api.lensAccount()).toMatchObject({ glAccountId: 1, netBalance: 120 });
    // balance AFTER each entry, walking newest -> oldest: 120, 20, 50
    expect(api.entries().map((e) => e.balanceAfter)).toEqual([120, 20, 50]);
    expect(api.entries().map((e) => [e.lensDebit, e.lensCredit])).toEqual([[100, 0], [0, 30], [50, 0]]);
    expect(api.columns().map((c) => c.field)).toEqual(
      ['entryNumber', 'entryDate', 'source', 'status', 'memo', 'accounts', 'total', 'lensDebit', 'lensCredit', 'balanceAfter']);
  });

  it('gives each entry an exportable total and account list', () => {
    const line = (id: number, glAccountId: number, accountNumber: string, accountName: string, debit: number, credit: number) => ({
      id, lineNumber: id, glAccountId, accountNumber, accountName, debit, credit, description: null, jobId: null, costCenterId: null,
    });
    gl.getLedgerRegister.mockReturnValue(of({
      ...PAGE,
      data: [{ ...ENTRY, lines: [line(1, 1, '1000', 'Cash', 60, 0), line(2, 1, '1000', 'Cash', 40, 0), line(3, 2, '4000', 'Revenue', 0, 100)] }],
    }));
    const api = create();
    expect(api.entries()[0].total).toBe(100);
    expect(api.entries()[0].accounts).toBe('1000 Cash; 4000 Revenue');
    expect(api.columns().map((c) => c.field)).toEqual(['entryNumber', 'entryDate', 'source', 'status', 'memo', 'accounts', 'total']);
  });

  it('counts the entries the loaded page leaves out', () => {
    gl.getLedgerRegister.mockReturnValue(of({ ...PAGE, totalCount: 250, totalPages: 3 }));
    expect(create().unloadedCount()).toBe(249);
    gl.getLedgerRegister.mockReturnValue(of(PAGE));
    expect(create().unloadedCount()).toBe(0);
  });

  it('reverses an entry via the dialog result, then reloads', () => {
    const api = create();
    api.reverseEntry(ENTRY);
    expect(dialog.open).toHaveBeenCalled();
    expect(gl.reverseJournalEntry).toHaveBeenCalledWith(1, { reversalDate: '2026-02-01', reason: 'wrong account' });
    expect(snackbar.success).toHaveBeenCalled();
    expect(gl.getLedgerRegister).toHaveBeenCalledTimes(2); // initial load + reload after reverse
  });

  it('surfaces an error when the load fails', () => {
    gl.getLedgerRegister.mockReturnValue(throwError(() => new Error('boom')));
    const api = create();
    expect(api.error()).toBe('accounting.errors.ledgerLoadFailed');
    expect(api.loading()).toBe(false);
  });

  it('fills in the AI explanation for an entry', () => {
    const api = create();
    api.explain(ENTRY);
    expect(gl.explainJournalEntry).toHaveBeenCalledWith(1, 1);
    expect(api.explanations()[1].result?.explanation).toBe('A $100 cash sale.');
    expect(api.explanations()[1].loading).toBe(false);
  });

  it('flags a failed explanation without throwing', () => {
    const api = create();
    gl.explainJournalEntry.mockReturnValue(throwError(() => new Error('offline')));
    api.explain(ENTRY);
    expect(api.explanations()[1].failed).toBe(true);
    expect(api.explanations()[1].result).toBeNull();
  });

  it('hands a failed anomaly scan to errorFrom and stops scanning', () => {
    const api = create();
    const err = new Error('offline');
    gl.getGlAnomalies.mockReturnValue(throwError(() => err));
    api.scanAnomalies();
    expect(snackbar.errorFrom).toHaveBeenCalledWith(err, 'accounting.errors.anomalyScanFailed');
    expect(snackbar.error).not.toHaveBeenCalled();
    expect(api.scanning()).toBe(false);
  });
});
