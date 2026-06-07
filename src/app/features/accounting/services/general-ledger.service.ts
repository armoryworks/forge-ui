import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  ApAging,
  ArAging,
  BalanceSheet,
  BankReconciliationWorksheet,
  CashFlowStatement,
  FiscalPeriodModel,
  FiscalPeriodStatus,
  FiscalYearModel,
  GrniReconciliation,
  ProfitAndLoss,
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
    return this.http.get<ProfitAndLoss>(`${this.base}/profit-and-loss`, { params: this.range(bookId, fromDate, toDate) });
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
}
