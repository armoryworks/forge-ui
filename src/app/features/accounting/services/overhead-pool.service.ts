import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { OverheadPoolCloseResult, RecordOverheadInput } from '../models/overhead-pool-close.model';
import { OverheadPoolStatus } from '../models/overhead-pool-status.model';
import { VarianceReport } from '../models/variance-report.model';

/**
 * Standard-costing overhead pool (`/api/v1/accounting/overhead`) and the variance rollup. Recording and closing
 * need CAP-ACCT-FULLGL; status and variances follow the ledger view.
 */
@Injectable({ providedIn: 'root' })
export class OverheadPoolService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/accounting`;

  status(asOf: string): Observable<OverheadPoolStatus> {
    return this.http.get<OverheadPoolStatus>(`${this.base}/overhead/status`, { params: new HttpParams().set('asOf', asOf) });
  }

  record(input: RecordOverheadInput): Observable<void> {
    return this.http.post<void>(`${this.base}/overhead/record`, input);
  }

  close(asOf: string): Observable<OverheadPoolCloseResult> {
    return this.http.post<OverheadPoolCloseResult>(`${this.base}/overhead/close`, { asOf });
  }

  variances(from: string, to: string): Observable<VarianceReport> {
    return this.http.get<VarianceReport>(`${this.base}/variances`, {
      params: new HttpParams().set('from', from).set('to', to),
    });
  }
}
