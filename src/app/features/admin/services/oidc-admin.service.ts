import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { OidcApproveClientRequest } from '../models/oidc-approve-client-request.model';
import { OidcAuditEventListItem } from '../models/oidc-audit-event-list-item.model';
import { OidcAuditFilter } from '../models/oidc-audit-filter.model';
import { OidcClientDetailResponse } from '../models/oidc-client-detail-response.model';
import { OidcClientListItem } from '../models/oidc-client-list-item.model';
import { OidcClientStatus } from '../models/oidc-client-status.model';
import { OidcCreateScopeRequest } from '../models/oidc-create-scope-request.model';
import { OidcMintTicketRequest } from '../models/oidc-mint-ticket-request.model';
import { OidcMintTicketResponse } from '../models/oidc-mint-ticket-response.model';
import { OidcRotateSecretResponse } from '../models/oidc-rotate-secret-response.model';
import { OidcScopeListItem } from '../models/oidc-scope-list-item.model';
import { OidcSuspendClientRequest } from '../models/oidc-suspend-client-request.model';
import { OidcTicketListItem } from '../models/oidc-ticket-list-item.model';
import { OidcTicketStatus } from '../models/oidc-ticket-status.model';
import { OidcUpdateClientRequest } from '../models/oidc-update-client-request.model';
import { OidcUpdateScopeRequest } from '../models/oidc-update-scope-request.model';

@Injectable({ providedIn: 'root' })
export class OidcAdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/oidc`;

  // ── Registration Tickets ──────────────────────────────────

  listTickets(status?: OidcTicketStatus): Observable<OidcTicketListItem[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<OidcTicketListItem[]>(`${this.base}/tickets`, { params });
  }

  mintTicket(body: OidcMintTicketRequest): Observable<OidcMintTicketResponse> {
    return this.http.post<OidcMintTicketResponse>(`${this.base}/tickets`, body);
  }

  revokeTicket(id: number, reason?: string): Observable<void> {
    let params = new HttpParams();
    if (reason) params = params.set('reason', reason);
    return this.http.delete<void>(`${this.base}/tickets/${id}`, { params });
  }

  // ── Clients ───────────────────────────────────────────────

  listClients(status?: OidcClientStatus): Observable<OidcClientListItem[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<OidcClientListItem[]>(`${this.base}/clients`, { params });
  }

  getClient(clientId: string): Observable<OidcClientDetailResponse> {
    return this.http.get<OidcClientDetailResponse>(`${this.base}/clients/${encodeURIComponent(clientId)}`);
  }

  approveClient(clientId: string, body: OidcApproveClientRequest): Observable<void> {
    return this.http.post<void>(`${this.base}/clients/${encodeURIComponent(clientId)}/approve`, body);
  }

  suspendClient(clientId: string, body: OidcSuspendClientRequest): Observable<void> {
    return this.http.post<void>(`${this.base}/clients/${encodeURIComponent(clientId)}/suspend`, body);
  }

  revokeClient(clientId: string, reason?: string): Observable<void> {
    let params = new HttpParams();
    if (reason) params = params.set('reason', reason);
    return this.http.delete<void>(`${this.base}/clients/${encodeURIComponent(clientId)}`, { params });
  }

  rotateSecret(clientId: string): Observable<OidcRotateSecretResponse> {
    return this.http.post<OidcRotateSecretResponse>(
      `${this.base}/clients/${encodeURIComponent(clientId)}/rotate-secret`,
      {},
    );
  }

  updateClient(clientId: string, body: OidcUpdateClientRequest): Observable<void> {
    return this.http.patch<void>(`${this.base}/clients/${encodeURIComponent(clientId)}`, body);
  }

  // ── Custom Scopes ─────────────────────────────────────────

  listScopes(includeInactive = false): Observable<OidcScopeListItem[]> {
    const params = new HttpParams().set('includeInactive', String(includeInactive));
    return this.http.get<OidcScopeListItem[]>(`${this.base}/scopes`, { params });
  }

  createScope(body: OidcCreateScopeRequest): Observable<{ id: number }> {
    return this.http.post<{ id: number }>(`${this.base}/scopes`, body);
  }

  updateScope(id: number, body: OidcUpdateScopeRequest): Observable<void> {
    return this.http.patch<void>(`${this.base}/scopes/${id}`, body);
  }

  deleteScope(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/scopes/${id}`);
  }

  // ── Audit ─────────────────────────────────────────────────

  listAudit(filter: OidcAuditFilter = {}): Observable<OidcAuditEventListItem[]> {
    let params = new HttpParams();
    if (filter.eventType) params = params.set('eventType', filter.eventType);
    if (filter.clientId) params = params.set('clientId', filter.clientId);
    if (filter.ticketId !== undefined) params = params.set('ticketId', String(filter.ticketId));
    if (filter.actorUserId !== undefined) params = params.set('actorUserId', String(filter.actorUserId));
    if (filter.since) params = params.set('since', filter.since);
    if (filter.until) params = params.set('until', filter.until);
    if (filter.skip !== undefined) params = params.set('skip', String(filter.skip));
    if (filter.take !== undefined) params = params.set('take', String(filter.take));
    return this.http.get<OidcAuditEventListItem[]>(`${this.base}/audit`, { params });
  }
}
