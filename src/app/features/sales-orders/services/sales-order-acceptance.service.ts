import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { SalesOrderAcceptance } from '../models/sales-order-acceptance.model';
import { PublicSoAcceptance } from '../models/public-so-acceptance.model';

/** Methods offered by the "Record acceptance" dialog (staff-driven capture). */
export type RecordAcceptanceMethod = 'ManualUpload' | 'Fax' | 'Email' | 'Verbal';

/** Multipart payload for the primary record-acceptance flow. */
export interface RecordAcceptanceInput {
  method: RecordAcceptanceMethod;
  note: string;
  /** Required unless `method === 'Verbal'`. */
  file?: File;
}

export interface SendSignatureInput {
  signerEmail: string;
  signerName: string;
}

/** Response for the e-signature send — the acceptance row plus the signing URL. */
export interface SendSignatureResult {
  acceptance: SalesOrderAcceptance;
  submitUrl: string;
}

export interface RequestPortalInput {
  recipientEmail: string;
  verificationKey: string;
  validDays?: number;
}

/** Response for a public-portal link mint — the acceptance row plus its token. */
export interface RequestPortalResult {
  acceptance: SalesOrderAcceptance;
  token: string;
}

export interface EmailIngestInput {
  fromEmail: string;
  note?: string;
}

export interface PublicAcceptInput {
  verificationKey: string;
  acceptedByName: string;
}

/**
 * Sales Order customer-acceptance API surface (CAP-O2C-SO-ACCEPTANCE).
 *
 * Staff endpoints hang off the canonical SalesOrder surface at
 * `/api/v1/orders/{id}/acceptance`; the anonymous customer-facing endpoints
 * live under `/api/v1/public/so-acceptance/{token}` and carry no auth token.
 */
@Injectable({ providedIn: 'root' })
export class SalesOrderAcceptanceService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/orders`;
  private readonly publicBase = `${environment.apiUrl}/public/so-acceptance`;

  /** Newest-first acceptance history for an order. */
  list(orderId: number): Observable<SalesOrderAcceptance[]> {
    return this.http.get<SalesOrderAcceptance[]>(`${this.base}/${orderId}/acceptance`);
  }

  /** Primary flow — record an acceptance (multipart; file required unless Verbal). */
  record(orderId: number, input: RecordAcceptanceInput): Observable<SalesOrderAcceptance> {
    const form = new FormData();
    form.append('method', input.method);
    form.append('note', input.note ?? '');
    if (input.file) form.append('file', input.file);
    return this.http.post<SalesOrderAcceptance>(`${this.base}/${orderId}/acceptance`, form);
  }

  /** Revoke an acceptance record (Admin only). */
  revoke(orderId: number, acceptanceId: number, reason: string): Observable<void> {
    const params = new HttpParams().set('reason', reason);
    return this.http.delete<void>(`${this.base}/${orderId}/acceptance/${acceptanceId}`, { params });
  }

  /** Send the order out for e-signature; returns the signing URL. */
  sendSignature(orderId: number, input: SendSignatureInput): Observable<SendSignatureResult> {
    return this.http.post<SendSignatureResult>(`${this.base}/${orderId}/acceptance/send-signature`, input);
  }

  /** Poll a pending e-signature record for a provider status update. */
  checkSignature(orderId: number, acceptanceId: number): Observable<SalesOrderAcceptance> {
    return this.http.post<SalesOrderAcceptance>(
      `${this.base}/${orderId}/acceptance/${acceptanceId}/check-signature`,
      {},
    );
  }

  /** Mint a public accept link; the customer link is `<origin>/accept/{token}`. */
  requestPortal(orderId: number, input: RequestPortalInput): Observable<RequestPortalResult> {
    return this.http.post<RequestPortalResult>(`${this.base}/${orderId}/acceptance/request-portal`, input);
  }

  /** Register an inbound email as a Pending Email acceptance (secondary flow). */
  emailIngest(orderId: number, input: EmailIngestInput): Observable<SalesOrderAcceptance> {
    return this.http.post<SalesOrderAcceptance>(`${this.base}/${orderId}/acceptance/email-ingest`, input);
  }

  /** Confirm a pending Email acceptance. */
  confirmEmail(orderId: number, acceptanceId: number): Observable<SalesOrderAcceptance> {
    return this.http.post<SalesOrderAcceptance>(
      `${this.base}/${orderId}/acceptance/${acceptanceId}/confirm-email`,
      {},
    );
  }

  // --- Public (anonymous) customer-facing surface ---

  /** Anonymous order summary for the customer accept page. */
  getPublic(token: string): Observable<PublicSoAcceptance> {
    return this.http.get<PublicSoAcceptance>(`${this.publicBase}/${token}`);
  }

  /** Anonymous accept POST from the customer accept page. */
  acceptPublic(token: string, input: PublicAcceptInput): Observable<void> {
    return this.http.post<void>(`${this.publicBase}/${token}/accept`, input);
  }
}
