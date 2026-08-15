import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { PagedResponse } from '../../../shared/models/paged-response.model';
import { ChannelSettlement, ChannelSettlementStatus } from '../models/channel-settlement.model';
import { ChannelSettlementDetail } from '../models/channel-settlement-detail.model';

export interface ChannelSettlementQuery {
  channelId?: number;
  status?: ChannelSettlementStatus;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface ImportSettlementsResult {
  imported: number;
  updated: number;
  reconciled: number;
  withDiscrepancy: number;
  unmatchedOrderLines: number;
}

@Injectable({ providedIn: 'root' })
export class ChannelSettlementService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/channel-settlements`;
  private readonly adminBase = `${environment.apiUrl}/admin/ecommerce`;

  getSettlements(query: ChannelSettlementQuery): Observable<PagedResponse<ChannelSettlement>> {
    let params = new HttpParams();
    if (query.channelId != null) params = params.set('channelId', query.channelId);
    if (query.status) params = params.set('status', query.status);
    if (query.q) params = params.set('q', query.q);
    if (query.page != null) params = params.set('page', query.page);
    if (query.pageSize != null) params = params.set('pageSize', query.pageSize);
    return this.http.get<PagedResponse<ChannelSettlement>>(this.base, { params });
  }

  getSettlement(id: number): Observable<ChannelSettlementDetail> {
    return this.http.get<ChannelSettlementDetail>(`${this.base}/${id}`);
  }

  /** Signs off on a variance that will not resolve. Requires a written reason; re-import never overwrites it. */
  acceptVariance(id: number, resolutionNotes: string): Observable<ChannelSettlement> {
    return this.http.post<ChannelSettlement>(`${this.base}/${id}/accept`, { resolutionNotes });
  }

  importSettlements(channelId: number): Observable<ImportSettlementsResult> {
    return this.http.post<ImportSettlementsResult>(
      `${this.adminBase}/channels/${channelId}/import-settlements`, {});
  }
}
