import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '../../../../environments/environment';
import { PagedResponse, PagedQuery } from '../../../shared/models/paged-response.model';
import { InvoiceListItem } from '../models/invoice-list-item.model';
import { InvoiceDetail } from '../models/invoice-detail.model';
import { CreateInvoiceRequest } from '../models/create-invoice-request.model';
import { UninvoicedJob } from '../models/uninvoiced-job.model';
import { InvoiceSources } from '../models/invoice-sources.model';
import { InvoiceQueueSettings } from '../models/invoice-queue-settings.model';
import { InvoiceEmailRecipient } from '../models/invoice-email-recipient.model';
import { SendInvoiceEmailRequest } from '../models/send-invoice-email-request.model';

/** Phase 3 F7-broad / WU-22 — paged invoice list query parameters. */
export interface InvoiceListPagedQuery extends PagedQuery {
  customerId?: number | null;
  status?: string;
  openOnly?: boolean;
}

@Injectable({ providedIn: 'root' })
export class InvoiceService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/invoices`;

  /**
   * Phase 3 F7-broad / WU-22 — backward-compat shim that calls the paged
   * endpoint and unwraps the envelope. Returns at most 200 invoices (the
   * server cap), newest first.
   */
  getInvoices(customerId?: number, status?: string): Observable<InvoiceListItem[]> {
    return this.getInvoicesPaged({ customerId, status, pageSize: 200 })
      .pipe(map(p => p.items));
  }

  /**
   * Open invoices for one customer — not Draft or Voided, with a balance due
   * above zero — filtered on the server so older open invoices are not lost
   * behind the 200-row page cap.
   */
  getOpenInvoices(customerId: number): Observable<InvoiceListItem[]> {
    return this.getInvoicesPaged({ customerId, openOnly: true, pageSize: 200, sort: 'dueDate', order: 'asc' })
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
    if (query.openOnly) params = params.set('openOnly', 'true');
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

  /**
   * Renames an invoice's business number via the dedicated endpoint. The server
   * only permits this while the invoice is in Draft status. With a `rowVersion`
   * the server refuses the rename (412) when someone else changed the invoice first.
   */
  renameInvoiceNumber(id: number, invoiceNumber: string, rowVersion?: number): Observable<void> {
    return this.http.patch<void>(`${this.base}/${id}/number`, { invoiceNumber }, { headers: ifMatch(rowVersion) });
  }

  sendInvoice(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/send`, {});
  }

  /** The customer-facing invoice PDF (same document the send action produces). */
  getInvoicePdf(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/pdf`, { responseType: 'blob' });
  }

  /** The default recipient for the invoice email: Billing contact, then customer email, then primary contact. */
  getEmailRecipient(id: number): Observable<InvoiceEmailRecipient> {
    return this.http.get<InvoiceEmailRecipient>(`${this.base}/${id}/email-recipient`);
  }

  /** Emails the invoice PDF to the recipient. Only a finalized invoice can be emailed. */
  emailInvoice(id: number, request: SendInvoiceEmailRequest): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/email`, request);
  }

  voidInvoice(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/void`, {});
  }

  deleteInvoice(id: number, rowVersion?: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`, { headers: ifMatch(rowVersion) });
  }

  getInvoiceSources(customerId: number): Observable<InvoiceSources> {
    const params = new HttpParams().set('customerId', String(customerId));
    return this.http.get<InvoiceSources>(`${this.base}/sources`, { params });
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

function ifMatch(rowVersion: number | undefined): HttpHeaders | undefined {
  return typeof rowVersion !== 'number'
    ? undefined
    : new HttpHeaders({ 'If-Match': `"${rowVersion}"` });
}
