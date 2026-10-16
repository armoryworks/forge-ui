import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { GlAccount, ManualJournalEntryResult, TrialBalance } from '../models/accounting.models';
import { ConversionStatus } from '../models/conversion-status.model';
import { OpeningJournalInput } from '../models/opening-journal-input.model';

/**
 * §7A cutover seam (`/api/v1/accounting/conversion/*`). Gated by CAP-ACCT-MIGRATION rather than the GL
 * capabilities, because the opening journal has to be posted before CAP-ACCT-FULLGL can be turned on.
 */
@Injectable({ providedIn: 'root' })
export class AccountingConversionService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/accounting/conversion`;

  /** The book's cutover state; without `bookId` the server picks the first active book. */
  getStatus(bookId?: number | null): Observable<ConversionStatus> {
    const params = bookId ? new HttpParams().set('bookId', bookId) : undefined;
    return this.http.get<ConversionStatus>(`${this.base}/status`, params ? { params } : {});
  }

  /** Postable accounts of the book, control accounts included, for the opening-journal lines. */
  getAccounts(bookId: number): Observable<GlAccount[]> {
    return this.http.get<GlAccount[]>(`${this.base}/accounts`, { params: new HttpParams().set('bookId', bookId) });
  }

  /** Post the opening journal. Idempotent per book: a second post returns the entry already posted. */
  importOpeningJournal(request: OpeningJournalInput): Observable<ManualJournalEntryResult> {
    return this.http.post<ManualJournalEntryResult>(`${this.base}/opening-journal`, request);
  }

  /** The book's native trial balance as of a date, for tying out against the legacy closing balances. */
  getTieOut(bookId: number, asOfDate?: string | null): Observable<TrialBalance> {
    let params = new HttpParams().set('bookId', bookId);
    if (asOfDate) params = params.set('asOfDate', asOfDate);
    return this.http.get<TrialBalance>(`${this.base}/tie-out`, { params });
  }
}
