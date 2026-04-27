import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { PurchaseOrderListItem } from '../models/purchase-order-list-item.model';
import { PurchaseOrderDetail } from '../models/purchase-order-detail.model';
import { CreatePurchaseOrderRequest } from '../models/create-purchase-order-request.model';
import { ReceiveItemsRequest } from '../models/receive-items-request.model';
import { PurchaseOrderRelease, CreatePurchaseOrderReleaseRequest, UpdatePurchaseOrderReleaseRequest } from '../models/purchase-order-release.model';
import { AutoPoSuggestion } from '../models/auto-po-suggestion.model';
import { AutoPoSettings, UpdateAutoPoSettingsRequest } from '../models/auto-po-settings.model';

@Injectable({ providedIn: 'root' })
export class PurchaseOrderService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/purchase-orders`;
  private readonly autoPoBase = `${environment.apiUrl}/auto-po`;

  getPurchaseOrders(vendorId?: number, jobId?: number, status?: string, search?: string): Observable<PurchaseOrderListItem[]> {
    let params = new HttpParams();
    if (vendorId) params = params.set('vendorId', String(vendorId));
    if (jobId) params = params.set('jobId', String(jobId));
    if (status) params = params.set('status', status);
    if (search) params = params.set('search', search);
    return this.http.get<PurchaseOrderListItem[]>(this.base, { params });
  }

  getPurchaseOrderById(id: number): Observable<PurchaseOrderDetail> {
    return this.http.get<PurchaseOrderDetail>(`${this.base}/${id}`);
  }

  createPurchaseOrder(request: CreatePurchaseOrderRequest): Observable<PurchaseOrderDetail> {
    return this.http.post<PurchaseOrderDetail>(this.base, request);
  }

  updatePurchaseOrder(id: number, request: { notes?: string; expectedDeliveryDate?: string }): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}`, request);
  }

  submitPurchaseOrder(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/submit`, {});
  }

  acknowledgePurchaseOrder(id: number, expectedDeliveryDate?: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/acknowledge`, { expectedDeliveryDate });
  }

  receiveItems(id: number, request: ReceiveItemsRequest): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/receive`, request);
  }

  cancelPurchaseOrder(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/cancel`, {});
  }

  closePurchaseOrder(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/close`, {});
  }

  // Phase 3 / WU-14 / H3 — short-close a partially-received PO with required reason.
  shortClosePurchaseOrder(id: number, reason: string): Observable<PurchaseOrderDetail> {
    return this.http.post<PurchaseOrderDetail>(`${this.base}/${id}/short-close`, { reason });
  }

  deletePurchaseOrder(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  // ── Blanket PO Releases ──

  getReleases(poId: number): Observable<PurchaseOrderRelease[]> {
    return this.http.get<PurchaseOrderRelease[]>(`${this.base}/${poId}/releases`);
  }

  createRelease(poId: number, request: CreatePurchaseOrderReleaseRequest): Observable<PurchaseOrderRelease> {
    return this.http.post<PurchaseOrderRelease>(`${this.base}/${poId}/releases`, request);
  }

  updateRelease(poId: number, releaseNum: number, request: UpdatePurchaseOrderReleaseRequest): Observable<void> {
    return this.http.patch<void>(`${this.base}/${poId}/releases/${releaseNum}`, request);
  }

  // ── Auto-PO ──

  getAutoPoSuggestions(status?: string): Observable<AutoPoSuggestion[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<AutoPoSuggestion[]>(`${this.autoPoBase}/suggestions`, { params });
  }

  convertSuggestion(id: number): Observable<number> {
    return this.http.post<number>(`${this.autoPoBase}/suggestions/${id}/convert`, {});
  }

  dismissSuggestion(id: number): Observable<void> {
    return this.http.post<void>(`${this.autoPoBase}/suggestions/${id}/dismiss`, {});
  }

  bulkConvertSuggestions(ids: number[]): Observable<number[]> {
    return this.http.post<number[]>(`${this.autoPoBase}/suggestions/bulk-convert`, ids);
  }

  triggerAutoPoRun(): Observable<void> {
    return this.http.post<void>(`${this.autoPoBase}/run`, {});
  }

  getAutoPoSettings(): Observable<AutoPoSettings> {
    return this.http.get<AutoPoSettings>(`${this.autoPoBase}/settings`);
  }

  updateAutoPoSettings(settings: UpdateAutoPoSettingsRequest): Observable<AutoPoSettings> {
    return this.http.patch<AutoPoSettings>(`${this.autoPoBase}/settings`, settings);
  }
}
