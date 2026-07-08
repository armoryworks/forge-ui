import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { FileAttachment } from '../../../shared/models/file.model';
import { QuoteListItem } from '../models/quote-list-item.model';
import { QuoteDetail } from '../models/quote-detail.model';
import { CreateQuoteRequest } from '../models/create-quote-request.model';
import { SalesOrderListItem } from '../../sales-orders/models/sales-order-list-item.model';
import { QuoteTermsPreview } from '../models/quote-terms-preview.model';
import { SendQuoteEmailRequest } from '../models/send-quote-email-request.model';

/** Payload to add a quote line (partId omitted = lump-sum / ad-hoc line). */
export interface QuoteLineInput {
  partId?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}

/** Payload to edit an existing quote line (the part link is fixed at add time). */
export interface UpdateLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}

@Injectable({ providedIn: 'root' })
export class QuoteService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/quotes`;

  getQuotes(customerId?: number, status?: string): Observable<QuoteListItem[]> {
    let params = new HttpParams();
    if (customerId) params = params.set('customerId', String(customerId));
    if (status) params = params.set('status', status);
    return this.http.get<QuoteListItem[]>(this.base, { params });
  }

  getQuoteById(id: number): Observable<QuoteDetail> {
    return this.http.get<QuoteDetail>(`${this.base}/${id}`);
  }

  /**
   * AUDIT-19-S1 / #26 — the customer-specific price-list unit price for a part,
   * or null when there's no applicable entry. Called on part-select to pre-fill
   * the line's unit price. Returns a bare decimal (or null) per the server contract.
   */
  resolvePrice(customerId: number, partId: number): Observable<number | null> {
    const params = new HttpParams()
      .set('customerId', String(customerId))
      .set('partId', String(partId));
    return this.http.get<number | null>(`${this.base}/resolve-price`, { params });
  }

  createQuote(request: CreateQuoteRequest): Observable<QuoteDetail> {
    return this.http.post<QuoteDetail>(this.base, request);
  }

  updateQuote(id: number, request: { shippingAddressId?: number; expirationDate?: string; notes?: string; taxRate?: number }): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}`, request);
  }

  /** Append a line to a draft quote. Returns the refreshed quote detail. */
  addQuoteLine(id: number, line: QuoteLineInput): Observable<QuoteDetail> {
    return this.http.post<QuoteDetail>(`${this.base}/${id}/lines`, line);
  }

  /** Edit an existing line on a draft quote. Returns the refreshed quote detail. */
  updateQuoteLine(id: number, lineId: number, line: UpdateLineInput): Observable<QuoteDetail> {
    return this.http.put<QuoteDetail>(`${this.base}/${id}/lines/${lineId}`, line);
  }

  /** Remove a line from a draft quote (a quote must keep at least one line). */
  deleteQuoteLine(id: number, lineId: number): Observable<QuoteDetail> {
    return this.http.delete<QuoteDetail>(`${this.base}/${id}/lines/${lineId}`);
  }

  sendQuote(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/send`, {});
  }

  /**
   * S3 — compiled company + customer + line-part terms for this quote, as the
   * email preview shows them. Called when the send-email dialog opens.
   */
  previewQuoteTerms(id: number): Observable<QuoteTermsPreview> {
    return this.http.get<QuoteTermsPreview>(`${this.base}/${id}/terms/preview`);
  }

  /**
   * S3 — send the quote email (PDF + terms + public link) to the recipient and
   * flip the quote to Sent.
   */
  sendQuoteEmail(id: number, request: SendQuoteEmailRequest): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/send-email`, request);
  }

  acceptQuote(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/accept`, {});
  }

  rejectQuote(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/reject`, {});
  }

  convertToOrder(id: number): Observable<SalesOrderListItem> {
    return this.http.post<SalesOrderListItem>(`${this.base}/${id}/convert`, {});
  }

  deleteQuote(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  // Documents — shared files API (mirrors sales-order.service). Uploads go
  // through <app-file-upload-zone>; list/delete/download live here.

  getDocuments(quoteId: number): Observable<FileAttachment[]> {
    return this.http.get<FileAttachment[]>(`${this.base}/${quoteId}/files`);
  }

  deleteFile(fileId: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/files/${fileId}`);
  }

  downloadFileUrl(fileId: number): string {
    return `${environment.apiUrl}/files/${fileId}/download`;
  }
}
