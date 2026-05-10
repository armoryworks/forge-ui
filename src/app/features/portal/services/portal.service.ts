import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  PortalIdentity,
  PortalInvoice,
  PortalQuote,
  PortalSalesOrder,
  PortalSession,
  PortalShipment,
  PortalSummary,
  RequestMagicLinkResult,
} from '../models/portal.model';

const TOKEN_KEY = 'portal-token';
const EXPIRES_KEY = 'portal-token-expires';
const IDENTITY_KEY = 'portal-identity';

/**
 * Portal-side auth + data service. Token storage is keyed off `portal-*`
 * so it can't accidentally collide with the employee `qbe-token`.
 * The portal interceptor reads the same key and attaches it to /portal/*
 * requests only.
 */
@Injectable({ providedIn: 'root' })
export class PortalService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/portal`;

  private readonly _identity = signal<PortalIdentity | null>(this.loadStoredIdentity());
  readonly identity = this._identity.asReadonly();
  readonly isAuthenticated = computed(() => this._identity() !== null && this.getToken() !== null);

  getToken(): string | null {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    const expiresRaw = localStorage.getItem(EXPIRES_KEY);
    if (expiresRaw && new Date(expiresRaw).getTime() < Date.now()) {
      this.clearSession();
      return null;
    }
    return token;
  }

  requestMagicLink(email: string): Observable<RequestMagicLinkResult> {
    return this.http.post<RequestMagicLinkResult>(`${this.base}/auth/request-link`, { email });
  }

  exchangeMagicLink(token: string): Observable<PortalSession> {
    return this.http.post<PortalSession>(`${this.base}/auth/exchange`, { token }).pipe(
      tap(session => this.persistSession(session)),
    );
  }

  getDashboard(): Observable<PortalSummary> {
    return this.http.get<PortalSummary>(`${this.base}/me/dashboard`);
  }

  getSalesOrders(): Observable<PortalSalesOrder[]> {
    return this.http.get<PortalSalesOrder[]>(`${this.base}/me/sales-orders`);
  }

  getQuotes(): Observable<PortalQuote[]> {
    return this.http.get<PortalQuote[]>(`${this.base}/me/quotes`);
  }

  getInvoices(): Observable<PortalInvoice[]> {
    return this.http.get<PortalInvoice[]>(`${this.base}/me/invoices`);
  }

  getShipments(): Observable<PortalShipment[]> {
    return this.http.get<PortalShipment[]>(`${this.base}/me/shipments`);
  }

  respondToQuote(quoteId: number, accepted: boolean): Observable<void> {
    return this.http.post<void>(`${this.base}/me/quotes/${quoteId}/respond`, { accepted });
  }

  logout(): void {
    this.clearSession();
  }

  private persistSession(session: PortalSession): void {
    localStorage.setItem(TOKEN_KEY, session.token);
    localStorage.setItem(EXPIRES_KEY, session.expiresAt);
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(session.identity));
    this._identity.set(session.identity);
  }

  private clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRES_KEY);
    localStorage.removeItem(IDENTITY_KEY);
    this._identity.set(null);
  }

  private loadStoredIdentity(): PortalIdentity | null {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PortalIdentity;
    } catch {
      return null;
    }
  }
}
