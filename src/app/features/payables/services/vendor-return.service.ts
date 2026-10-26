import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { VendorReturnListItem } from '../models/vendor-return-list-item.model';
import { VendorReturnDetail } from '../models/vendor-return-detail.model';
import { ShipVendorReturnRequest } from '../models/ship-vendor-return-request.model';
import { RecordVendorReturnCreditRequest } from '../models/record-vendor-return-credit-request.model';
import { VendorCreditMemoDetail } from '../models/vendor-credit-memo-detail.model';

/** Returns to vendor that NCR Return To Vendor dispositions open. */
@Injectable({ providedIn: 'root' })
export class VendorReturnService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/vendor-returns`;

  getReturns(vendorId?: number | null, status?: string | null, nonConformanceId?: number | null): Observable<VendorReturnListItem[]> {
    let params = new HttpParams();
    if (vendorId) params = params.set('vendorId', String(vendorId));
    if (status) params = params.set('status', status);
    if (nonConformanceId) params = params.set('nonConformanceId', String(nonConformanceId));
    return this.http.get<VendorReturnListItem[]>(this.base, { params });
  }

  getById(id: number): Observable<VendorReturnDetail> {
    return this.http.get<VendorReturnDetail>(`${this.base}/${id}`);
  }

  /** Takes the held stock out of quality hold and inventory into the vendor returns clearing account. */
  ship(id: number, request: ShipVendorReturnRequest): Observable<VendorReturnDetail> {
    return this.http.post<VendorReturnDetail>(`${this.base}/${id}/ship`, request);
  }

  /** Issues the vendor's credit memo for a shipped return. */
  recordCredit(id: number, request: RecordVendorReturnCreditRequest): Observable<VendorCreditMemoDetail> {
    return this.http.post<VendorCreditMemoDetail>(`${this.base}/${id}/credit`, request);
  }

  getPdf(id: number, lang: string): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/pdf`, { params: new HttpParams().set('lang', lang), responseType: 'blob' });
  }
}
