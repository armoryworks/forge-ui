import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { QboAccountMapping } from '../models/qbo-account-mapping.model';
import { QboPushResult } from '../models/qbo-push-result.model';

/** The three QB-001 CSV files the CPA can pull. */
export type CsvExportKind = 'trial-balance' | 'gl-detail' | 'journal-summary';

/**
 * QB-001 CPA exports seam: the always-available CSV downloads
 * (`/accounting/exports/*.csv`, CAP-ACCT-FULLGL) and the config-gated one-way
 * QBO journal-summary push (`/accounting/qbo-export/*`, CAP-ACCT-QBO-EXPORT).
 * QuickBooks is never the system of record — the push only writes downstream.
 */
@Injectable({ providedIn: 'root' })
export class AccountingExportService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/accounting`;

  /** Fetch one CSV export as a blob (full response so the caller can read Content-Disposition). */
  downloadCsv(
    kind: CsvExportKind,
    bookId: number,
    fromDate?: string | null,
    toDate?: string | null,
  ): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.base}/exports/${kind}.csv`, {
      params: this.range(bookId, fromDate, toDate),
      responseType: 'blob',
      observe: 'response',
    });
  }

  // ── QBO mapping + push (CAP-ACCT-QBO-EXPORT) ──

  getQboMappings(bookId: number): Observable<QboAccountMapping[]> {
    return this.http.get<QboAccountMapping[]>(`${this.base}/qbo-export/mappings`, {
      params: new HttpParams().set('bookId', bookId),
    });
  }

  upsertQboMapping(glAccountId: number, qboAccountId: string, qboAccountName?: string | null): Observable<QboAccountMapping> {
    return this.http.put<QboAccountMapping>(`${this.base}/qbo-export/mappings/${glAccountId}`, {
      qboAccountId,
      qboAccountName: qboAccountName ?? null,
    });
  }

  deleteQboMapping(glAccountId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/qbo-export/mappings/${glAccountId}`);
  }

  pushToQbo(bookId: number, fromDate: string, toDate: string): Observable<QboPushResult> {
    const params = this.range(bookId, fromDate, toDate);
    return this.http.post<QboPushResult>(`${this.base}/qbo-export/push`, {}, { params });
  }

  private range(bookId: number, fromDate?: string | null, toDate?: string | null): HttpParams {
    let params = new HttpParams().set('bookId', bookId);
    if (fromDate) params = params.set('fromDate', fromDate);
    if (toDate) params = params.set('toDate', toDate);
    return params;
  }
}
