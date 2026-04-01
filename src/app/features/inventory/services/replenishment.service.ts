import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { BurnRate } from '../models/burn-rate.model';
import { ReorderSuggestion, BulkApproveResult } from '../models/reorder-suggestion.model';

@Injectable({ providedIn: 'root' })
export class ReplenishmentService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/replenishment`;

  getBurnRates(search?: string, needsReorderOnly = false): Observable<BurnRate[]> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    if (needsReorderOnly) params = params.set('needsReorderOnly', 'true');
    return this.http.get<BurnRate[]>(`${this.base}/burn-rates`, { params });
  }

  getSuggestions(status?: string): Observable<ReorderSuggestion[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<ReorderSuggestion[]>(`${this.base}/suggestions`, { params });
  }

  approveSuggestion(id: number): Observable<ReorderSuggestion> {
    return this.http.post<ReorderSuggestion>(`${this.base}/suggestions/${id}/approve`, {});
  }

  approveBulk(suggestionIds: number[]): Observable<BulkApproveResult> {
    return this.http.post<BulkApproveResult>(`${this.base}/suggestions/approve-bulk`, { suggestionIds });
  }

  dismissSuggestion(id: number, reason: string): Observable<void> {
    return this.http.post<void>(`${this.base}/suggestions/${id}/dismiss`, { reason });
  }
}
