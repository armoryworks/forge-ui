import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { VendorPaymentListItem } from '../models/vendor-payment-list-item.model';
import { VendorPaymentDetail } from '../models/vendor-payment-detail.model';
import { CreateVendorPaymentRequest } from '../models/create-vendor-payment-request.model';

// ⚡ ACCOUNTING BOUNDARY — AP counterpart of PaymentService.
@Injectable({ providedIn: 'root' })
export class VendorPaymentService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/vendor-payments`;

  getVendorPayments(vendorId?: number): Observable<VendorPaymentListItem[]> {
    let params = new HttpParams();
    if (vendorId) params = params.set('vendorId', String(vendorId));
    return this.http.get<VendorPaymentListItem[]>(this.base, { params });
  }

  getVendorPaymentById(id: number): Observable<VendorPaymentDetail> {
    return this.http.get<VendorPaymentDetail>(`${this.base}/${id}`);
  }

  createVendorPayment(request: CreateVendorPaymentRequest): Observable<VendorPaymentListItem> {
    return this.http.post<VendorPaymentListItem>(this.base, request);
  }

  /**
   * Voids a vendor payment: cancels any pending bank transmission, reverses the
   * GL entry, drops bill applications (bills reopen), and soft-deletes the
   * payment. Server rejects (409) once the transmission has Succeeded.
   */
  voidVendorPayment(id: number, reason: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/void`, { reason });
  }
}
