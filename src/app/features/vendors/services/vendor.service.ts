import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '../../../../environments/environment';
import { PagedResponse, PagedQuery } from '../../../shared/models/paged-response.model';
import { VendorListItem } from '../models/vendor-list-item.model';
import { VendorDetail } from '../models/vendor-detail.model';
import { VendorResponse } from '../models/vendor-response.model';
import { CreateVendorRequest } from '../models/create-vendor-request.model';
import { UpdateVendorRequest } from '../models/update-vendor-request.model';
import { VendorScorecard, VendorComparisonRow } from '../models/vendor-scorecard.model';

/** Phase 3 F7-broad / WU-22 — paged vendor list query parameters. */
export interface VendorListPagedQuery extends PagedQuery {
  isActive?: boolean | null;
}

@Injectable({ providedIn: 'root' })
export class VendorService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/vendors`;

  /**
   * Phase 3 F7-broad / WU-22 — backward-compat shim that calls the paged
   * endpoint and unwraps the envelope. New callers should use
   * {@link getVendorsPaged} so they can read `totalCount` for proper
   * server-side pagination.
   */
  getVendors(search?: string, isActive?: boolean): Observable<VendorListItem[]> {
    return this.getVendorsPaged({
      q: search,
      isActive,
      pageSize: 200,
    }).pipe(map(p => p.items));
  }

  /**
   * Phase 3 F7-broad / WU-22 — paged vendor list. Returns the standard
   * envelope ({ items, totalCount, page, pageSize }) so the caller can wire
   * up real server-side pagination, sort, and filtering.
   */
  getVendorsPaged(query: VendorListPagedQuery = {}): Observable<PagedResponse<VendorListItem>> {
    let params = new HttpParams();
    if (query.page != null) params = params.set('page', String(query.page));
    if (query.pageSize != null) params = params.set('pageSize', String(query.pageSize));
    if (query.sort) params = params.set('sort', query.sort);
    if (query.order) params = params.set('order', query.order);
    if (query.q) params = params.set('q', query.q);
    if (query.isActive !== undefined && query.isActive !== null) params = params.set('isActive', String(query.isActive));
    if (query.dateFrom) params = params.set('dateFrom', query.dateFrom);
    if (query.dateTo) params = params.set('dateTo', query.dateTo);
    return this.http.get<PagedResponse<VendorListItem>>(this.base, { params });
  }

  getVendorById(id: number): Observable<VendorDetail> {
    return this.http.get<VendorDetail>(`${this.base}/${id}`);
  }

  getVendorDropdown(): Observable<VendorResponse[]> {
    return this.http.get<VendorResponse[]>(`${this.base}/dropdown`);
  }

  createVendor(request: CreateVendorRequest): Observable<VendorListItem> {
    return this.http.post<VendorListItem>(this.base, request);
  }

  updateVendor(id: number, request: UpdateVendorRequest): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}`, request);
  }

  deleteVendor(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  getVendorScorecard(vendorId: number, dateFrom?: string, dateTo?: string): Observable<VendorScorecard> {
    let params = new HttpParams();
    if (dateFrom) params = params.set('dateFrom', dateFrom);
    if (dateTo) params = params.set('dateTo', dateTo);
    return this.http.get<VendorScorecard>(`${this.base}/${vendorId}/scorecard`, { params });
  }

  getPerformanceReport(dateFrom?: string, dateTo?: string): Observable<VendorComparisonRow[]> {
    let params = new HttpParams();
    if (dateFrom) params = params.set('dateFrom', dateFrom);
    if (dateTo) params = params.set('dateTo', dateTo);
    return this.http.get<VendorComparisonRow[]>(`${this.base}/performance-report`, { params });
  }
}
