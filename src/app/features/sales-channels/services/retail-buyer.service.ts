import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { PagedResponse } from '../../../shared/models/paged-response.model';
import { RetailBuyer } from '../models/retail-buyer.model';

export interface RetailBuyerQuery {
  channelId?: number;
  isPurged?: boolean;
  q?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

/** Result of a PII scrub: the buyer plus every frozen ship-to that was redacted with them. */
export interface PurgePiiResult {
  buyersPurged: number;
  addressesPurged: number;
}

@Injectable({ providedIn: 'root' })
export class RetailBuyerService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/retail-orders`;

  getBuyers(query: RetailBuyerQuery): Observable<PagedResponse<RetailBuyer>> {
    let params = new HttpParams();
    if (query.channelId != null) params = params.set('channelId', query.channelId);
    if (query.isPurged != null) params = params.set('isPurged', query.isPurged);
    if (query.q) params = params.set('q', query.q);
    if (query.sort) params = params.set('sort', query.sort);
    if (query.order) params = params.set('order', query.order);
    if (query.page != null) params = params.set('page', query.page);
    if (query.pageSize != null) params = params.set('pageSize', query.pageSize);
    return this.http.get<PagedResponse<RetailBuyer>>(`${this.base}/buyers`, { params });
  }

  /** Irreversible. Scrubs identifying columns; keeps the row, its orders and its totals. Admin-only server-side. */
  purgePii(buyerId: number): Observable<PurgePiiResult> {
    return this.http.post<PurgePiiResult>(`${this.base}/buyers/${buyerId}/purge-pii`, {});
  }
}
