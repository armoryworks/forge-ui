import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { OpeningBalanceResult } from '../models/opening-balance-result.model';
import { OpeningOpenItem } from '../models/opening-open-item.model';
import { OpeningOpenItemsValidation } from '../models/opening-open-items-validation.model';

/** §7A opening AR/AP open items: the dry run and the post (CAP-ACCT-MIGRATION or CAP-ACCT-FULLGL). */
@Injectable({ providedIn: 'root' })
export class OpeningOpenItemsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/accounting/conversion/open-items`;

  validate(bookId: number, rows: OpeningOpenItem[]): Observable<OpeningOpenItemsValidation> {
    return this.http.post<OpeningOpenItemsValidation>(`${this.base}/validate`, { bookId, rows });
  }

  post(
    bookId: number,
    asOfDate: string,
    receivablesControl: number,
    payablesControl: number,
    rows: OpeningOpenItem[],
  ): Observable<OpeningBalanceResult> {
    return this.http.post<OpeningBalanceResult>(this.base, { bookId, asOfDate, receivablesControl, payablesControl, rows });
  }
}
