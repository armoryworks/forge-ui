import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { VendorBillListItem } from '../models/vendor-bill-list-item.model';
import { VendorBillDetail } from '../models/vendor-bill-detail.model';
import { CreateVendorBillRequest } from '../models/create-vendor-bill-request.model';

// ⚡ ACCOUNTING BOUNDARY — AP counterpart of InvoiceService.
@Injectable({ providedIn: 'root' })
export class VendorBillService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/vendor-bills`;

  /** List vendor bills. `status` takes a single value — combine client-side for "open" views. */
  getVendorBills(vendorId?: number, status?: string): Observable<VendorBillListItem[]> {
    let params = new HttpParams();
    if (vendorId) params = params.set('vendorId', String(vendorId));
    if (status) params = params.set('status', status);
    return this.http.get<VendorBillListItem[]>(this.base, { params });
  }

  getVendorBillById(id: number): Observable<VendorBillDetail> {
    return this.http.get<VendorBillDetail>(`${this.base}/${id}`);
  }

  createVendorBill(request: CreateVendorBillRequest): Observable<VendorBillListItem> {
    return this.http.post<VendorBillListItem>(this.base, request);
  }

  /** Draft → Approved; posts to the GL when CAP-ACCT-FULLGL is on. */
  approveVendorBill(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/approve`, {});
  }

  /** Draft = cancel; Approved = GL reversal + restores PO billed quantities. */
  voidVendorBill(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/void`, {});
  }
}
