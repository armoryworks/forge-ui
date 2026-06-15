import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { AutoPoSuggestion } from '../models/auto-po-suggestion.model';

@Injectable({ providedIn: 'root' })
export class AutoPoService {
  private readonly http = inject(HttpClient);
  // Backend serves auto-PO suggestions under AutoPoController at
  // /api/v1/auto-po/suggestions (NOT /purchase-orders/suggestions — that base
  // 404'd on convert/dismiss).
  private readonly base = `${environment.apiUrl}/auto-po/suggestions`;

  getSuggestions(status?: string): Observable<AutoPoSuggestion[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<AutoPoSuggestion[]>(this.base, { params });
  }

  convertSuggestion(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/convert`, {});
  }

  dismissSuggestion(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/dismiss`, {});
  }
}
