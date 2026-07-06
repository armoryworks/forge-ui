import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  ApAging,
  ArAging,
  BalanceSheet,
  BankReconciliationSummary,
  BankReconciliationWorksheet,
  CashAccountModel,
  CashFlowStatement,
  FiscalPeriodModel,
  FiscalPeriodStatus,
  FiscalYearModel,
  GlAccount,
  GlAnomaly,
  GlAnomalyFilter,
  GrniReconciliation,
  JournalEntryExplanation,
  LedgerRegisterFilter,
  LedgerRegisterPage,
  ManualJournalEntryInput,
  ManualJournalEntryResult,
  ProfitAndLoss,
  ReverseJournalEntryInput,
  TrialBalance,
  YearEndCloseResult,
} from '../models/accounting.models';

/**
 * Read/operate seam for the dark GL accounting suite (`/api/v1/accounting/*`). Every call is gated server-side
 * behind CAP-ACCT-FULLGL (statements add CAP-RPT-FINANCIALS) and short-circuited client-side by the
 * capability endpoint registry, so this service is only reachable when the suite is switched on.
 */
@Injectable({ providedIn: 'root' })
export class GeneralLedgerService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/accounting`;

  private range(bookId: number, fromDate?: string | null, toDate?: string | null): HttpParams {
    let params = new HttpParams().set('bookId', bookId);
    if (fromDate) params = params.set('fromDate', fromDate);
    if (toDate) params = params.set('toDate', toDate);
    return params;
  }

  // ── Financial statements ──
  getTrialBalance(bookId: number, fromDate?: string | null, toDate?: string | null): Observable<TrialBalance> {
    return this.http.get<TrialBalance>(`${this.base}/trial-balance`, { params: this.range(bookId, fromDate, toDate) });
  }

  getProfitAndLoss(bookId: number, fromDate?: string | null, toDate?: string | null): Observable<ProfitAndLoss> {
    // Server route is /accounting/pnl (AccountingGlController [HttpGet("pnl")]); the old
    // /profit-and-loss path 404'd.
    return this.http.get<ProfitAndLoss>(`${this.base}/pnl`, { params: this.range(bookId, fromDate, toDate) });
  }

  getBalanceSheet(bookId: number, asOfDate?: string | null): Observable<BalanceSheet> {
    let params = new HttpParams().set('bookId', bookId);
    if (asOfDate) params = params.set('asOfDate', asOfDate);
    return this.http.get<BalanceSheet>(`${this.base}/balance-sheet`, { params });
  }

  getCashFlow(bookId: number, fromDate?: string | null, toDate?: string | null): Observable<CashFlowStatement> {
    return this.http.get<CashFlowStatement>(`${this.base}/cash-flow`, { params: this.range(bookId, fromDate, toDate) });
  }

  // ── Sub-ledger aging + GRNI ──
  getArAging(bookId: number, asOfDate?: string | null): Observable<ArAging> {
    let params = new HttpParams().set('bookId', bookId);
    if (asOfDate) params = params.set('asOfDate', asOfDate);
    return this.http.get<ArAging>(`${this.base}/ar-aging`, { params });
  }

  getApAging(bookId: number, asOfDate?: string | null): Observable<ApAging> {
    let params = new HttpParams().set('bookId', bookId);
    if (asOfDate) params = params.set('asOfDate', asOfDate);
    return this.http.get<ApAging>(`${this.base}/ap-aging`, { params });
  }

  getGrniReconciliation(bookId: number, asOfDate?: string | null): Observable<GrniReconciliation> {
    let params = new HttpParams().set('bookId', bookId);
    if (asOfDate) params = params.set('asOfDate', asOfDate);
    return this.http.get<GrniReconciliation>(`${this.base}/grni-reconciliation`, { params });
  }

  // ── Period / year close ──
  getFiscalCalendar(bookId: number): Observable<FiscalYearModel[]> {
    return this.http.get<FiscalYearModel[]>(`${this.base}/fiscal-calendar`, {
      params: new HttpParams().set('bookId', bookId),
    });
  }

  setPeriodStatus(periodId: number, target: FiscalPeriodStatus): Observable<FiscalPeriodModel> {
    const verb = target === 'SoftClosed' ? 'soft-close' : target === 'HardClosed' ? 'hard-close' : 'reopen';
    return this.http.post<FiscalPeriodModel>(`${this.base}/periods/${periodId}/${verb}`, {});
  }

  closeFiscalYear(fiscalYearId: number): Observable<YearEndCloseResult> {
    return this.http.post<YearEndCloseResult>(`${this.base}/years/${fiscalYearId}/close`, {});
  }

  // ── Bank reconciliation ──
  getCashAccounts(bookId: number): Observable<CashAccountModel[]> {
    return this.http.get<CashAccountModel[]>(`${this.base}/cash-accounts`, {
      params: new HttpParams().set('bookId', bookId),
    });
  }

  getBankReconciliations(bookId: number): Observable<BankReconciliationSummary[]> {
    return this.http.get<BankReconciliationSummary[]>(`${this.base}/bank-reconciliations`, {
      params: new HttpParams().set('bookId', bookId),
    });
  }

  startBankReconciliation(
    bookId: number, cashGlAccountId: number, statementDate: string, statementEndingBalance: number,
  ): Observable<BankReconciliationWorksheet> {
    return this.http.post<BankReconciliationWorksheet>(`${this.base}/bank-reconciliations`, {
      bookId, cashGlAccountId, statementDate, statementEndingBalance,
    });
  }

  getBankReconciliation(reconciliationId: number): Observable<BankReconciliationWorksheet> {
    return this.http.get<BankReconciliationWorksheet>(`${this.base}/bank-reconciliations/${reconciliationId}`);
  }

  setBankReconciliationItemCleared(
    reconciliationId: number, journalLineId: number, cleared: boolean,
  ): Observable<BankReconciliationWorksheet> {
    const params = new HttpParams().set('cleared', cleared);
    return this.http.post<BankReconciliationWorksheet>(
      `${this.base}/bank-reconciliations/${reconciliationId}/items/${journalLineId}/cleared`, {}, { params });
  }

  finalizeBankReconciliation(reconciliationId: number): Observable<BankReconciliationWorksheet> {
    return this.http.post<BankReconciliationWorksheet>(`${this.base}/bank-reconciliations/${reconciliationId}/finalize`, {});
  }

  // ── Ledger register + AI advisory (§5A) ──
  /** Time-ordered GL register for the ledger-view UI — newest first, paginated, optionally filtered. */
  getLedgerRegister(bookId: number, filter?: LedgerRegisterFilter): Observable<LedgerRegisterPage> {
    let params = new HttpParams().set('bookId', bookId);
    if (filter?.fromDate) params = params.set('fromDate', filter.fromDate);
    if (filter?.toDate) params = params.set('toDate', filter.toDate);
    if (filter?.status) params = params.set('status', filter.status);
    if (filter?.glAccountId) params = params.set('glAccountId', filter.glAccountId);
    if (filter?.page) params = params.set('page', filter.page);
    if (filter?.pageSize) params = params.set('pageSize', filter.pageSize);
    return this.http.get<LedgerRegisterPage>(`${this.base}/ledger`, { params });
  }

  /** Read-only AI advisory: a plain-language explanation of a journal entry (degrades to a deterministic summary offline). */
  explainJournalEntry(bookId: number, entryId: number): Observable<JournalEntryExplanation> {
    return this.http.get<JournalEntryExplanation>(`${this.base}/journal-entries/${entryId}/explain`, {
      params: new HttpParams().set('bookId', bookId),
    });
  }

  /** Chart of accounts for the manual-entry editor's account picker. `postableOnly` drops control accounts. */
  getChartOfAccounts(bookId: number, postableOnly = false): Observable<GlAccount[]> {
    let params = new HttpParams().set('bookId', bookId);
    if (postableOnly) params = params.set('postableOnly', true);
    return this.http.get<GlAccount[]>(`${this.base}/accounts`, { params });
  }

  /** Post a balanced manual journal entry via the GL posting engine. */
  createManualJournalEntry(request: ManualJournalEntryInput): Observable<ManualJournalEntryResult> {
    return this.http.post<ManualJournalEntryResult>(`${this.base}/journal-entries`, request);
  }

  /** Deterministic reviewer anomaly scan over posted manual entries (feeds the AI-explain workflow). */
  getGlAnomalies(bookId: number, filter?: GlAnomalyFilter): Observable<GlAnomaly[]> {
    let params = new HttpParams().set('bookId', bookId);
    if (filter?.fromDate) params = params.set('fromDate', filter.fromDate);
    if (filter?.toDate) params = params.set('toDate', filter.toDate);
    if (filter?.largeManualThreshold) params = params.set('largeManualThreshold', filter.largeManualThreshold);
    return this.http.get<GlAnomaly[]>(`${this.base}/anomalies`, { params });
  }

  /** Reverse a posted journal entry — posts an equal-and-opposite entry; the original is never edited. */
  reverseJournalEntry(entryId: number, request: ReverseJournalEntryInput): Observable<ManualJournalEntryResult> {
    return this.http.post<ManualJournalEntryResult>(`${this.base}/journal-entries/${entryId}/reverse`, request);
  }
}
