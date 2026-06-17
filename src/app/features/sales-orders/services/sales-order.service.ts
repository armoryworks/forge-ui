import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { SalesOrderListItem } from '../models/sales-order-list-item.model';
import { SalesOrderDetail } from '../models/sales-order-detail.model';
import { SalesOrderInvoice } from '../models/sales-order-invoice.model';
import { CreateSalesOrderRequest } from '../models/create-sales-order-request.model';
import { FileAttachment } from '../../../shared/models/file.model';
import { ScheduleMilestone } from '../models/schedule-milestone.model';
import { PagedQuery, PagedResponse } from '../../../shared/models/paged-response.model';

/** Phase 3 F1 partial / WU-18 — extra filter dimensions on the SO list. */
export interface SalesOrderListQuery extends PagedQuery {
  customerId?: number;
  status?: string;
  /** "orderDate" (default; uses Job.CreatedAt) or "shipDate" (uses Job.DueDate). */
  dateField?: 'orderDate' | 'shipDate';
}

/** Payload to add a sales-order line (partId omitted = lump-sum / ad-hoc line). */
export interface SalesOrderLineInput {
  partId?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}

/** Payload to edit an existing sales-order line (part link fixed at add time). */
export interface UpdateSalesOrderLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}

@Injectable({ providedIn: 'root' })
export class SalesOrderService {
  private readonly http = inject(HttpClient);
  /**
   * Mutations + detail/schedule/documents/invoices live on the legacy
   * `/api/v1/orders` SalesOrders surface (the canonical SalesOrder entity).
   */
  private readonly base = `${environment.apiUrl}/orders`;
  /**
   * Phase 3 F1 partial / WU-18 — read-only Job-projected list at
   * `/api/v1/sales-orders`. Returns the standard PagedResponse envelope.
   */
  private readonly listBase = `${environment.apiUrl}/sales-orders`;

  /**
   * Phase 3 F1 partial / WU-18 — paged Job-projected sales-order list.
   *
   * Returns the standard `{ items, totalCount, page, pageSize }` envelope.
   * Underlying server endpoint filters Jobs to "Order Confirmed" stage and
   * downstream production stages, projecting to the SO-shape DTO.
   */
  getSalesOrdersPaged(query: SalesOrderListQuery = {}): Observable<PagedResponse<SalesOrderListItem>> {
    let params = new HttpParams();
    if (query.page) params = params.set('page', String(query.page));
    if (query.pageSize) params = params.set('pageSize', String(query.pageSize));
    if (query.sort) params = params.set('sort', query.sort);
    if (query.order) params = params.set('order', query.order);
    if (query.q) params = params.set('q', query.q);
    if (query.dateFrom) params = params.set('dateFrom', query.dateFrom);
    if (query.dateTo) params = params.set('dateTo', query.dateTo);
    if (query.dateField) params = params.set('dateField', query.dateField);
    if (query.customerId) params = params.set('customerId', String(query.customerId));
    if (query.status) params = params.set('status', query.status);
    return this.http.get<PagedResponse<SalesOrderListItem>>(this.listBase, { params });
  }

  /**
   * Backward-compat shim. Existing callers that want the flat array continue
   * to work — internally calls the paged endpoint with `pageSize=200` and
   * unwraps to the array.
   */
  getSalesOrders(customerId?: number, status?: string, search?: string): Observable<SalesOrderListItem[]> {
    return this.getSalesOrdersPaged({
      customerId,
      status,
      q: search,
      pageSize: 200,
    }).pipe(map((p) => p.items));
  }

  getSalesOrderById(id: number): Observable<SalesOrderDetail> {
    return this.http.get<SalesOrderDetail>(`${this.base}/${id}`);
  }

  /**
   * AUDIT-19-S1 / #26 — the customer-specific price-list unit price for a part,
   * or null when there's no applicable entry. Called on part-select to pre-fill
   * the line's unit price. The resolver lives on the quotes surface, so this hits
   * `/quotes/resolve-price` (shared by quote + SO line editors).
   */
  resolvePrice(customerId: number, partId: number): Observable<number | null> {
    const params = new HttpParams()
      .set('customerId', String(customerId))
      .set('partId', String(partId));
    return this.http.get<number | null>(`${environment.apiUrl}/quotes/resolve-price`, { params });
  }

  createSalesOrder(request: CreateSalesOrderRequest): Observable<SalesOrderDetail> {
    return this.http.post<SalesOrderDetail>(this.base, request);
  }

  updateSalesOrder(id: number, request: {
    shippingAddressId?: number;
    billingAddressId?: number;
    creditTerms?: string;
    requestedDeliveryDate?: string;
    customerPO?: string;
    notes?: string;
    taxRate?: number;
  }): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}`, request);
  }

  /** Append a line to a draft sales order. Returns the refreshed order detail. */
  addSalesOrderLine(id: number, line: SalesOrderLineInput): Observable<SalesOrderDetail> {
    return this.http.post<SalesOrderDetail>(`${this.base}/${id}/lines`, line);
  }

  /** Edit an existing line on a draft sales order. Returns the refreshed detail. */
  updateSalesOrderLine(id: number, lineId: number, line: UpdateSalesOrderLineInput): Observable<SalesOrderDetail> {
    return this.http.put<SalesOrderDetail>(`${this.base}/${id}/lines/${lineId}`, line);
  }

  /** Remove a line from a draft sales order (must keep at least one line). */
  deleteSalesOrderLine(id: number, lineId: number): Observable<SalesOrderDetail> {
    return this.http.delete<SalesOrderDetail>(`${this.base}/${id}/lines/${lineId}`);
  }

  confirmSalesOrder(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/confirm`, {});
  }

  cancelSalesOrder(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/cancel`, {});
  }

  deleteSalesOrder(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  getSchedule(soId: number): Observable<ScheduleMilestone[]> {
    return this.http.get<ScheduleMilestone[]>(`${this.base}/${soId}/schedule`);
  }

  getDocuments(orderId: number): Observable<FileAttachment[]> {
    return this.http.get<FileAttachment[]>(`${this.base}/${orderId}/documents`);
  }

  getInvoices(orderId: number): Observable<SalesOrderInvoice[]> {
    return this.http.get<SalesOrderInvoice[]>(`${this.base}/${orderId}/invoices`);
  }

  deleteFile(fileId: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/files/${fileId}`);
  }

  downloadFileUrl(fileId: number): string {
    return `${environment.apiUrl}/files/${fileId}/download`;
  }
}
