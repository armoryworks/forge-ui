import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map, tap } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { SILENT_HTTP_ERRORS } from '../../../shared/interceptors/silent-http-errors.token';
import {
  PortalIdentity,
  PortalInvoice,
  PortalList,
  PortalQuote,
  PortalSalesOrder,
  PortalSession,
  PortalShipment,
  PortalSummary,
  RequestMagicLinkResult,
} from '../models/portal.model';
import { PortalCredit } from '../models/portal-credit.model';

const TOKEN_KEY = 'portal-token';
const EXPIRES_KEY = 'portal-token-expires';
const IDENTITY_KEY = 'portal-identity';
const TOTAL_COUNT_HEADER = 'X-Total-Count';
const EXTERNAL_ACCOUNTING_HEADER = 'X-External-Accounting';

/**
 * Portal-side auth + data service. Token storage is keyed off `portal-*`
 * so it can't accidentally collide with the employee `forge-token`.
 * The portal interceptor reads the same key and attaches it to /portal/*
 * requests only.
 */
@Injectable({ providedIn: 'root' })
export class PortalService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly base = `${environment.apiUrl}/portal`;

  private readonly _identity = signal<PortalIdentity | null>(this.loadStoredIdentity());
  readonly identity = this._identity.asReadonly();
  isAuthenticated(): boolean {
    return this._identity() !== null && this.getToken() !== null;
  }

  getToken(): string | null {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    const expiresRaw = localStorage.getItem(EXPIRES_KEY);
    if (expiresRaw && new Date(expiresRaw).getTime() < Date.now()) {
      return null;
    }
    return token;
  }

  hasLapsedSession(): boolean {
    const stored = this._identity() !== null || localStorage.getItem(TOKEN_KEY) !== null;
    return stored && this.getToken() === null;
  }

  endSession(): void {
    this.clearSession();
    this.router.navigate(['/portal/login'], { queryParams: { reason: 'session_expired' } });
  }

  requestMagicLink(email: string): Observable<RequestMagicLinkResult> {
    return this.http.post<RequestMagicLinkResult>(`${this.base}/auth/request-link`, { email }, {
      context: new HttpContext().set(SILENT_HTTP_ERRORS, true),
    });
  }

  exchangeMagicLink(token: string): Observable<PortalSession> {
    return this.http.post<PortalSession>(`${this.base}/auth/exchange`, { token }).pipe(
      tap(session => this.persistSession(session)),
    );
  }

  getDashboard(): Observable<PortalSummary> {
    return this.http.get<PortalSummary>(`${this.base}/me/dashboard`);
  }

  getSalesOrders(): Observable<PortalList<PortalSalesOrder>> {
    return this.getList<PortalSalesOrder>('sales-orders');
  }

  getQuotes(): Observable<PortalList<PortalQuote>> {
    return this.getList<PortalQuote>('quotes');
  }

  getInvoices(): Observable<PortalList<PortalInvoice>> {
    return this.getList<PortalInvoice>('invoices');
  }

  getCredits(): Observable<PortalList<PortalCredit>> {
    return this.getList<PortalCredit>('credits');
  }

  getShipments(): Observable<PortalList<PortalShipment>> {
    return this.getList<PortalShipment>('shipments');
  }

  respondToQuote(quoteId: number, accepted: boolean): Observable<void> {
    return this.http.post<void>(`${this.base}/me/quotes/${quoteId}/respond`, { accepted });
  }

  private getList<T>(path: string): Observable<PortalList<T>> {
    return this.http.get<T[]>(`${this.base}/me/${path}`, { observe: 'response' }).pipe(
      map((response: HttpResponse<T[]>) => {
        const items = response.body ?? [];
        const total = Number(response.headers.get(TOTAL_COUNT_HEADER));
        return {
          items,
          totalCount: Number.isFinite(total) && total > items.length ? total : items.length,
          externalAccounting: response.headers.get(EXTERNAL_ACCOUNTING_HEADER) === 'true',
        };
      }),
    );
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
