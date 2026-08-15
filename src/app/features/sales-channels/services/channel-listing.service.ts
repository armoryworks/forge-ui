import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { PagedResponse } from '../../../shared/models/paged-response.model';
import { ChannelListing } from '../models/channel-listing.model';

export interface ChannelListingQuery {
  channelId?: number;
  isUnmapped?: boolean;
  includeInactive?: boolean;
  q?: string;
  page?: number;
  pageSize?: number;
}

/** Result of a mapping change, including how many historical order lines were back-filled. */
export interface MapListingResult {
  listing: ChannelListing;
  backfilledOrderLines: number;
}

@Injectable({ providedIn: 'root' })
export class ChannelListingService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/channel-listings`;
  private readonly adminBase = `${environment.apiUrl}/admin/ecommerce`;

  getListings(query: ChannelListingQuery): Observable<PagedResponse<ChannelListing>> {
    let params = new HttpParams();
    if (query.channelId != null) params = params.set('channelId', query.channelId);
    if (query.isUnmapped != null) params = params.set('isUnmapped', query.isUnmapped);
    if (query.includeInactive != null) params = params.set('includeInactive', query.includeInactive);
    if (query.q) params = params.set('q', query.q);
    if (query.page != null) params = params.set('page', query.page);
    if (query.pageSize != null) params = params.set('pageSize', query.pageSize);
    return this.http.get<PagedResponse<ChannelListing>>(this.base, { params });
  }

  /** Pass null to clear the mapping. Setting one back-fills already-imported lines for the same SKU. */
  mapListing(id: number, partId: number | null): Observable<MapListingResult> {
    return this.http.put<MapListingResult>(`${this.base}/${id}/mapping`, { partId });
  }

  syncListings(channelId: number): Observable<SyncListingsResult> {
    return this.http.post<SyncListingsResult>(`${this.adminBase}/channels/${channelId}/sync-listings`, {});
  }
}

export interface SyncListingsResult {
  created: number;
  updated: number;
  deactivated: number;
  unmapped: number;
}
