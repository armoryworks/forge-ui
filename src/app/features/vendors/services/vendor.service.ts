import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { VendorListItem } from '../models/vendor-list-item.model';
import { VendorDetail } from '../models/vendor-detail.model';
import { VendorResponse } from '../models/vendor-response.model';
import { CreateVendorRequest } from '../models/create-vendor-request.model';
import { UpdateVendorRequest } from '../models/update-vendor-request.model';
import { VendorScorecard, VendorComparisonRow } from '../models/vendor-scorecard.model';

@Injectable({ providedIn: 'root' })
export class VendorService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/vendors`;

  getVendors(search?: string, isActive?: boolean): Observable<VendorListItem[]> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    if (isActive !== undefined) params = params.set('isActive', String(isActive));
    return this.http.get<VendorListItem[]>(this.base, { params });
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
