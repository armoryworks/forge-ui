import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { VendorBankAccount } from '../models/vendor-bank-account.model';
import { PaymentBatchListItem } from '../models/payment-batch-list-item.model';
import { PaymentBatchDetail } from '../models/payment-batch-detail.model';
import { BatchEligiblePayment } from '../models/batch-eligible-payment.model';
import { BankReturnsImportResult } from '../models/bank-returns-import-result.model';

// ⚡ BANKING BOUNDARY — BANK-002 Phase A: vendor bank accounts (dual control + prenote) and
// NACHA payment batches (assemble → generate → download → portal upload → release = SoD).
@Injectable({ providedIn: 'root' })
export class BankingService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/banking`;

  // ── Vendor bank accounts ──
  getBankAccounts(vendorId?: number, status?: string): Observable<VendorBankAccount[]> {
    let params = new HttpParams();
    if (vendorId) params = params.set('vendorId', String(vendorId));
    if (status) params = params.set('status', status);
    return this.http.get<VendorBankAccount[]>(`${this.base}/bank-accounts`, { params });
  }

  createBankAccount(
    vendorId: number,
    request: { nickname: string; accountType: string; routingNumber: string; accountNumber: string },
  ): Observable<VendorBankAccount> {
    return this.http.post<VendorBankAccount>(`${this.base}/vendors/${vendorId}/bank-accounts`, request);
  }

  updateBankAccount(
    id: number,
    request: { nickname: string; accountType: string; routingNumber: string; accountNumber: string },
  ): Observable<VendorBankAccount> {
    return this.http.put<VendorBankAccount>(`${this.base}/bank-accounts/${id}`, request);
  }

  approveBankAccount(id: number): Observable<VendorBankAccount> {
    return this.http.post<VendorBankAccount>(`${this.base}/bank-accounts/${id}/approve`, {});
  }

  markBankAccountVerified(id: number): Observable<VendorBankAccount> {
    return this.http.post<VendorBankAccount>(`${this.base}/bank-accounts/${id}/mark-verified`, {});
  }

  disableBankAccount(id: number): Observable<VendorBankAccount> {
    return this.http.post<VendorBankAccount>(`${this.base}/bank-accounts/${id}/disable`, {});
  }

  // ── Payment batches ──
  getBatches(): Observable<PaymentBatchListItem[]> {
    return this.http.get<PaymentBatchListItem[]>(`${this.base}/payment-batches`);
  }

  getBatch(id: number): Observable<PaymentBatchDetail> {
    return this.http.get<PaymentBatchDetail>(`${this.base}/payment-batches/${id}`);
  }

  getEligiblePayments(): Observable<BatchEligiblePayment[]> {
    return this.http.get<BatchEligiblePayment[]>(`${this.base}/payment-batches/eligible-payments`);
  }

  createBatch(vendorPaymentIds: number[], effectiveEntryDate: string): Observable<PaymentBatchDetail> {
    return this.http.post<PaymentBatchDetail>(`${this.base}/payment-batches`, { vendorPaymentIds, effectiveEntryDate });
  }

  createPrenoteBatch(effectiveEntryDate: string): Observable<PaymentBatchDetail> {
    return this.http.post<PaymentBatchDetail>(`${this.base}/payment-batches/prenote`, { effectiveEntryDate });
  }

  generateBatch(id: number): Observable<PaymentBatchDetail> {
    return this.http.post<PaymentBatchDetail>(`${this.base}/payment-batches/${id}/generate`, {});
  }

  downloadBatchFile(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/payment-batches/${id}/file`, { responseType: 'blob' });
  }

  releaseBatch(id: number): Observable<PaymentBatchDetail> {
    return this.http.post<PaymentBatchDetail>(`${this.base}/payment-batches/${id}/release`, {});
  }

  cancelBatch(id: number): Observable<PaymentBatchDetail> {
    return this.http.post<PaymentBatchDetail>(`${this.base}/payment-batches/${id}/cancel`, {});
  }

  /** Phase C: apply a bank ACH return/NOC file (idempotent server-side). */
  importReturns(file: File): Observable<BankReturnsImportResult> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<BankReturnsImportResult>(`${this.base}/returns/import`, form);
  }
}
