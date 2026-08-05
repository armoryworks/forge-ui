import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  I18nLabelOverride,
  RetryPendingI18nTranslationsResult,
  UpsertI18nLabelOverrideRequest,
  UpsertI18nLabelOverrideResult,
} from '../models/i18n-label-override.model';

@Injectable({ providedIn: 'root' })
export class I18nLabelService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/i18n/overrides`;

  list(): Observable<I18nLabelOverride[]> {
    return this.http.get<I18nLabelOverride[]>(this.base);
  }

  upsert(request: UpsertI18nLabelOverrideRequest): Observable<UpsertI18nLabelOverrideResult> {
    return this.http.put<UpsertI18nLabelOverrideResult>(this.base, request);
  }

  revert(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  retryPending(): Observable<RetryPendingI18nTranslationsResult> {
    return this.http.post<RetryPendingI18nTranslationsResult>(`${this.base}/retry-pending`, {});
  }

  /** Shipped catalog for one language — the base values the editor diffs overrides against. */
  baseCatalog(languageCode: string): Observable<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(`/assets/i18n/${languageCode}.json`);
  }
}
