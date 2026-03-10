import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { InvoiceListItem } from '../models/invoice-list-item.model';
import { InvoiceDetail } from '../models/invoice-detail.model';
import { CreateInvoiceRequest } from '../models/create-invoice-request.model';

@Injectable({ providedIn: 'root' })
export class InvoiceService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/invoices`;

  getInvoices(customerId?: number, status?: string): Observable<InvoiceListItem[]> {
    let params = new HttpParams();
    if (customerId) params = params.set('customerId', String(customerId));
    if (status) params = params.set('status', status);
    return this.http.get<InvoiceListItem[]>(this.base, { params });
  }

  getInvoiceById(id: number): Observable<InvoiceDetail> {
    return this.http.get<InvoiceDetail>(`${this.base}/${id}`);
  }

  createInvoice(request: CreateInvoiceRequest): Observable<InvoiceDetail> {
    return this.http.post<InvoiceDetail>(this.base, request);
  }

  sendInvoice(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/send`, {});
  }

  voidInvoice(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/void`, {});
  }

  deleteInvoice(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
