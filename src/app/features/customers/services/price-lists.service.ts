import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { PagedResponse } from '../../../shared/models/paged-response.model';
import {
  CreatePriceListEntryRequest,
  PriceList,
  PriceListEntry,
  UpdatePriceListEntryRequest,
} from '../models/price-list.model';

/**
 * Wraps the customer-pricing endpoints. Mirrors the patterns used by
 * `CustomerService` (HttpParams builder, environment.apiUrl) so the surface
 * is consistent with the rest of the customers feature.
 */
@Injectable({ providedIn: 'root' })
export class PriceListsService {
  private readonly http = inject(HttpClient);
  private readonly priceListsBase = `${environment.apiUrl}/price-lists`;
  private readonly entriesBase = `${environment.apiUrl}/price-list-entries`;

  listForCustomer(customerId: number): Observable<PriceList[]> {
    return this.http.get<PriceList[]>(
      `${environment.apiUrl}/customers/${customerId}/price-lists`,
    );
  }

  getEntries(
    priceListId: number,
    query: { search?: string | null; page?: number; pageSize?: number } = {},
  ): Observable<PagedResponse<PriceListEntry>> {
    let params = new HttpParams();
    if (query.search) params = params.set('search', query.search);
    if (query.page != null) params = params.set('page', String(query.page));
    if (query.pageSize != null) params = params.set('pageSize', String(query.pageSize));
    return this.http.get<PagedResponse<PriceListEntry>>(
      `${this.priceListsBase}/${priceListId}/entries`,
      { params },
    );
  }

  createEntry(priceListId: number, body: CreatePriceListEntryRequest): Observable<PriceListEntry> {
    return this.http.post<PriceListEntry>(
      `${this.priceListsBase}/${priceListId}/entries`,
      body,
    );
  }

  updateEntry(entryId: number, body: UpdatePriceListEntryRequest): Observable<PriceListEntry> {
    return this.http.put<PriceListEntry>(`${this.entriesBase}/${entryId}`, body);
  }

  deleteEntry(entryId: number): Observable<void> {
    return this.http.delete<void>(`${this.entriesBase}/${entryId}`);
  }
}
