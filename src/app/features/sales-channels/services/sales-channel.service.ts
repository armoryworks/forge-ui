import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { SalesChannel, SalesChannelType } from '../models/sales-channel.model';
import { CreateSalesChannelRequest } from '../models/create-sales-channel-request.model';
import { UpdateSalesChannelRequest } from '../models/update-sales-channel-request.model';

/**
 * Sales-channel administration. Channels are install configuration — they decide
 * where orders route, which account carries a receivable, and who is liable for
 * the tax — so mutations are Admin/Manager server-side.
 */
@Injectable({ providedIn: 'root' })
export class SalesChannelService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/sales-channels`;

  getChannels(includeInactive = false, channelType?: SalesChannelType): Observable<SalesChannel[]> {
    let params = new HttpParams().set('includeInactive', includeInactive);
    if (channelType) params = params.set('channelType', channelType);
    return this.http.get<SalesChannel[]>(this.base, { params });
  }

  getChannel(id: number): Observable<SalesChannel> {
    return this.http.get<SalesChannel>(`${this.base}/${id}`);
  }

  createChannel(body: CreateSalesChannelRequest): Observable<SalesChannel> {
    return this.http.post<SalesChannel>(this.base, body);
  }

  updateChannel(id: number, body: UpdateSalesChannelRequest): Observable<SalesChannel> {
    return this.http.put<SalesChannel>(`${this.base}/${id}`, body);
  }

  /** Makes this the fallback for orders created without an explicit channel. Retail channels are refused server-side. */
  setDefault(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/set-default`, {});
  }

  deleteChannel(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
