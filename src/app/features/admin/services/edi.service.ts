import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { EdiTradingPartner } from '../models/edi-trading-partner.model';
import { EdiTransaction } from '../models/edi-transaction.model';
import { EdiTransactionDetail } from '../models/edi-transaction-detail.model';
import { EdiMapping } from '../models/edi-mapping.model';
import { EdiDirection } from '../models/edi-direction.model';
import { EdiTransactionStatus } from '../models/edi-transaction-status.model';

interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class EdiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/edi';

  // ── Trading Partners ──────────────────────────────────────

  getTradingPartners(isActive?: boolean): Observable<EdiTradingPartner[]> {
    let params = new HttpParams();
    if (isActive !== undefined) params = params.set('isActive', isActive);
    return this.http.get<EdiTradingPartner[]>(`${this.baseUrl}/trading-partners`, { params });
  }

  getTradingPartner(id: number): Observable<EdiTradingPartner> {
    return this.http.get<EdiTradingPartner>(`${this.baseUrl}/trading-partners/${id}`);
  }

  createTradingPartner(partner: Partial<EdiTradingPartner>): Observable<EdiTradingPartner> {
    return this.http.post<EdiTradingPartner>(`${this.baseUrl}/trading-partners`, partner);
  }

  updateTradingPartner(id: number, partner: Partial<EdiTradingPartner>): Observable<EdiTradingPartner> {
    return this.http.put<EdiTradingPartner>(`${this.baseUrl}/trading-partners/${id}`, partner);
  }

  deleteTradingPartner(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/trading-partners/${id}`);
  }

  testConnection(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.baseUrl}/trading-partners/${id}/test`, {});
  }

  // ── Transactions ──────────────────────────────────────────

  getTransactions(filters?: {
    direction?: EdiDirection;
    transactionSet?: string;
    status?: EdiTransactionStatus;
    tradingPartnerId?: number;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
  }): Observable<PaginatedResponse<EdiTransaction>> {
    let params = new HttpParams();
    if (filters?.direction) params = params.set('direction', filters.direction);
    if (filters?.transactionSet) params = params.set('transactionSet', filters.transactionSet);
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.tradingPartnerId) params = params.set('tradingPartnerId', filters.tradingPartnerId);
    if (filters?.dateFrom) params = params.set('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params = params.set('dateTo', filters.dateTo);
    if (filters?.page) params = params.set('page', filters.page);
    if (filters?.pageSize) params = params.set('pageSize', filters.pageSize);
    return this.http.get<PaginatedResponse<EdiTransaction>>(`${this.baseUrl}/transactions`, { params });
  }

  getTransaction(id: number): Observable<EdiTransactionDetail> {
    return this.http.get<EdiTransactionDetail>(`${this.baseUrl}/transactions/${id}`);
  }

  receiveDocument(rawPayload: string, tradingPartnerId: number): Observable<EdiTransaction> {
    return this.http.post<EdiTransaction>(`${this.baseUrl}/receive`, { rawPayload, tradingPartnerId });
  }

  sendOutbound(entityType: string, entityId: number, tradingPartnerId: number): Observable<EdiTransaction> {
    return this.http.post<EdiTransaction>(`${this.baseUrl}/send/${entityType}/${entityId}`, { tradingPartnerId });
  }

  retryTransaction(id: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/transactions/${id}/retry`, {});
  }

  // ── Mappings ──────────────────────────────────────────────

  getMappings(tradingPartnerId: number): Observable<EdiMapping[]> {
    return this.http.get<EdiMapping[]>(`${this.baseUrl}/trading-partners/${tradingPartnerId}/mappings`);
  }

  createMapping(tradingPartnerId: number, mapping: Partial<EdiMapping>): Observable<EdiMapping> {
    return this.http.post<EdiMapping>(`${this.baseUrl}/trading-partners/${tradingPartnerId}/mappings`, mapping);
  }

  updateMapping(id: number, mapping: Partial<EdiMapping>): Observable<EdiMapping> {
    return this.http.put<EdiMapping>(`${this.baseUrl}/mappings/${id}`, mapping);
  }

  deleteMapping(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/mappings/${id}`);
  }
}
