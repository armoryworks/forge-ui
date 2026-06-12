import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  BankStatementImportModel,
  BankStatementLineModel,
  ImportBankStatementResultModel,
} from '../models/accounting.models';

// ⚡ BANK-001 — bank statement import + auto-match staging (CAP-ACCT-FULLGL).
@Injectable({ providedIn: 'root' })
export class BankStatementService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/accounting/bank-statements`;

  import(bookId: number, cashGlAccountId: number, file: File): Observable<ImportBankStatementResultModel> {
    const form = new FormData();
    form.append('bookId', String(bookId));
    form.append('cashGlAccountId', String(cashGlAccountId));
    form.append('file', file, file.name);
    return this.http.post<ImportBankStatementResultModel>(`${this.base}/import`, form);
  }

  getImports(cashGlAccountId?: number): Observable<BankStatementImportModel[]> {
    let params = new HttpParams();
    if (cashGlAccountId) params = params.set('cashGlAccountId', String(cashGlAccountId));
    return this.http.get<BankStatementImportModel[]>(this.base, { params });
  }

  getLines(importId: number, status?: string): Observable<BankStatementLineModel[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<BankStatementLineModel[]>(`${this.base}/${importId}/lines`, { params });
  }

  autoMatch(importId: number): Observable<number> {
    return this.http.post<number>(`${this.base}/${importId}/auto-match`, {});
  }

  confirm(lineId: number): Observable<BankStatementLineModel> {
    return this.http.post<BankStatementLineModel>(`${this.base}/lines/${lineId}/confirm`, {});
  }

  ignore(lineId: number): Observable<BankStatementLineModel> {
    return this.http.post<BankStatementLineModel>(`${this.base}/lines/${lineId}/ignore`, {});
  }

  unmatch(lineId: number): Observable<BankStatementLineModel> {
    return this.http.post<BankStatementLineModel>(`${this.base}/lines/${lineId}/unmatch`, {});
  }
}
