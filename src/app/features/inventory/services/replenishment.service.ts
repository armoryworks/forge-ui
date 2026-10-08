import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { BurnRate } from '../models/burn-rate.model';
import { ReorderSuggestion, BulkApproveResult } from '../models/reorder-suggestion.model';
import { ReplenishmentSettings } from '../models/replenishment-settings.model';
import { AdminUser } from '../../admin/models/admin-user.model';
import { UserRef } from '../../kanban/models/user-ref.model';
import { SILENT_HTTP_ERRORS } from '../../../shared/interceptors/silent-http-errors.token';

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

  getSettings(): Observable<ReplenishmentSettings> {
    return this.http.get<ReplenishmentSettings>(`${this.base}/settings`);
  }

  updateSettings(settings: ReplenishmentSettings): Observable<ReplenishmentSettings> {
    return this.http.put<ReplenishmentSettings>(`${this.base}/settings`, settings);
  }

  getAssigneeCandidates(): Observable<{ id: number; name: string }[]> {
    return this.http
      .get<AdminUser[]>(`${environment.apiUrl}/admin/users`, {
        context: new HttpContext().set(SILENT_HTTP_ERRORS, true),
      })
      .pipe(
        map(users => users
          .filter(u => u.isActive && (u.roles.includes('Admin') || u.roles.includes('Manager')))
          .map(u => ({ id: u.id, name: `${u.firstName} ${u.lastName}`.trim() }))),
        catchError(() => this.http
          .get<UserRef[]>(`${environment.apiUrl}/users`)
          .pipe(
            map(users => users.map(u => ({ id: u.id, name: u.name }))),
            catchError(() => of([])),
          )),
      );
  }
}
