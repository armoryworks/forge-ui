import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '../../../../environments/environment';
import { PagedResponse, PagedQuery } from '../../../shared/models/paged-response.model';
import { InvoiceListItem } from '../models/invoice-list-item.model';
import { InvoiceDetail } from '../models/invoice-detail.model';
import { CreateInvoiceRequest } from '../models/create-invoice-request.model';
import { UninvoicedJob } from '../models/uninvoiced-job.model';
import { InvoiceQueueSettings } from '../models/invoice-queue-settings.model';

/** Phase 3 F7-broad / WU-22 — paged invoice list query parameters. */
export interface InvoiceListPagedQuery extends PagedQuery {
  customerId?: number | null;
  status?: string;
}

@Injectable({ providedIn: 'root' })
export class InvoiceService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/invoices`;

  /**
   * Phase 3 F7-broad / WU-22 — backward-compat shim that calls the paged
   * endpoint and unwraps the envelope.
   */
  getInvoices(customerId?: number, status?: string): Observable<InvoiceListItem[]> {
    return this.getInvoicesPaged({ customerId, status, pageSize: 200 })
      .pipe(map(p => p.items));
  }

  /**
   * Phase 3 F7-broad / WU-22 — paged invoice list. Returns the standard
   * envelope ({ items, totalCount, page, pageSize }).
   */
  getInvoicesPaged(query: InvoiceListPagedQuery = {}): Observable<PagedResponse<InvoiceListItem>> {
    let params = new HttpParams();
    if (query.page != null) params = params.set('page', String(query.page));
    if (query.pageSize != null) params = params.set('pageSize', String(query.pageSize));
    if (query.sort) params = params.set('sort', query.sort);
    if (query.order) params = params.set('order', query.order);
    if (query.q) params = params.set('q', query.q);
    if (query.customerId) params = params.set('customerId', String(query.customerId));
    if (query.status) params = params.set('status', query.status);
    if (query.dateFrom) params = params.set('dateFrom', query.dateFrom);
    if (query.dateTo) params = params.set('dateTo', query.dateTo);
    return this.http.get<PagedResponse<InvoiceListItem>>(this.base, { params });
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

  getUninvoicedJobs(): Observable<UninvoicedJob[]> {
    return this.http.get<UninvoicedJob[]>(`${this.base}/uninvoiced-jobs`);
  }

  createInvoiceFromJob(jobId: number): Observable<InvoiceListItem> {
    return this.http.post<InvoiceListItem>(`${this.base}/from-job/${jobId}`, {});
  }

  getQueueSettings(): Observable<InvoiceQueueSettings> {
    return this.http.get<InvoiceQueueSettings>(`${this.base}/queue-settings`);
  }

  updateQueueSettings(mode: string, assignedUserId: number | null): Observable<void> {
    return this.http.put<void>(`${this.base}/queue-settings`, { mode, assignedUserId });
  }
}
