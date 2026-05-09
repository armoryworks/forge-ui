import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { finalize, Observable, tap } from 'rxjs';

import {
  CommunicationProviderInfo,
  CommunicationSyncConfigSummary,
  CreateCommunicationSyncConfigRequest,
} from '../models/communication-sync.model';
import { ImapConnectRequest } from '../models/imap-connect-request.model';

/**
 * Wave 8 — Angular service for the communication-sync surface. Wraps
 * /api/v1/communications/connections (GET / POST / DELETE).
 *
 * The provider catalog is currently client-side because adapters land
 * incrementally — when the IMAP / Twilio / Gmail / MS Graph adapters are
 * registered server-side the catalog moves behind a /providers endpoint
 * (mirrors UserIntegrationService).
 */
@Injectable({ providedIn: 'root' })
export class CommunicationsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/communications';

  readonly connections = signal<CommunicationSyncConfigSummary[]>([]);
  readonly loading = signal(false);
  /** Connection ids currently syncing — keyed for per-card spinner state. */
  readonly syncing = signal<Set<number>>(new Set());

  /**
   * Static provider catalog. Each entry implements `ICommunicationSyncProvider`
   * server-side OR is reserved for a planned phase. The "mock" entries
   * exist so dev/admin can drive the matcher end-to-end before real
   * mailbox/phone integrations land.
   */
  readonly providers: readonly CommunicationProviderInfo[] = [
    {
      providerId: 'mock-email',
      kind: 'Email',
      displayName: 'Mock Email Provider',
      description: 'Synthetic emails for testing — never connects to a real mailbox.',
      icon: 'science',
      status: 'mock',
    },
    {
      // Server-side ProviderId for the mock voice provider is "mock-voip"
      // (matches the existing VoIP nomenclature used elsewhere in the
      // capability catalog: CAP-EXT-VOIP-SYNC, etc.).
      providerId: 'mock-voip',
      kind: 'Voice',
      displayName: 'Mock Voice Provider',
      description: 'Synthetic calls for testing — never places or receives real calls.',
      icon: 'science',
      status: 'mock',
    },
    {
      providerId: 'imap',
      kind: 'Email',
      displayName: 'IMAP Mailbox',
      description: 'Universal email — works with Gmail, Outlook, Yahoo, Fastmail, custom servers.',
      icon: 'mail',
      status: 'available',
    },
    {
      // OAuth-IMAP (SASL OAUTHBEARER). Backed server-side by ProviderId
      // "imap" with ConfigJson.AuthMethod="oauth"; the catalog uses
      // "gmail-oauth" so the UI can route to the OAuth flow rather than
      // the password dialog. Admin must set OAuthImap:Google credentials
      // in appsettings before this provider is selectable.
      providerId: 'gmail-oauth',
      kind: 'Email',
      displayName: 'Gmail',
      description: 'Google Workspace / Gmail via OAuth — no app password required.',
      icon: 'mark_email_read',
      status: 'available',
    },
    {
      providerId: 'microsoft-oauth',
      kind: 'Email',
      displayName: 'Outlook / Microsoft 365',
      description: 'Outlook / Microsoft 365 via OAuth — supports MFA + work/school accounts.',
      icon: 'forward_to_inbox',
      status: 'available',
    },
    {
      providerId: 'twilio',
      kind: 'Voice',
      displayName: 'Twilio',
      description: 'Twilio Voice — webhook-driven inbound + recording sync.',
      icon: 'phone_in_talk',
      status: 'planned',
    },
    {
      providerId: 'ringcentral',
      kind: 'Voice',
      displayName: 'RingCentral',
      description: 'RingCentral cloud PBX — call events + recordings.',
      icon: 'phone',
      status: 'planned',
    },
  ];

  loadConnections(): void {
    this.loading.set(true);
    this.http.get<CommunicationSyncConfigSummary[]>(`${this.baseUrl}/connections`).subscribe({
      next: (data) => {
        this.connections.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  create(request: CreateCommunicationSyncConfigRequest): Observable<CommunicationSyncConfigSummary> {
    return this.http.post<CommunicationSyncConfigSummary>(`${this.baseUrl}/connections`, request).pipe(
      tap(() => this.loadConnections()),
    );
  }

  /**
   * IMAP-specific connect path — server test-authenticates against the
   * live server before persisting, encrypts the password en route to the
   * sealed envelope. 4xx response on bad creds / unreachable host.
   */
  connectImap(request: ImapConnectRequest): Observable<CommunicationSyncConfigSummary> {
    return this.http.post<CommunicationSyncConfigSummary>(`${this.baseUrl}/connections/imap`, request).pipe(
      tap(() => this.loadConnections()),
    );
  }

  /**
   * Phase 1k.2 — initiate OAuth-IMAP flow. Server generates a state
   * token + returns the authorize URL. Caller opens that URL (popup or
   * navigation); the redirect lands on the SPA callback page which
   * posts the code+state back via {@link completeOAuthImap}.
   */
  beginOAuthImap(provider: 'google' | 'microsoft'): Observable<{ authorizeUrl: string; state: string }> {
    return this.http.post<{ authorizeUrl: string; state: string }>(
      `${this.baseUrl}/oauth/imap/${provider}/begin`, {});
  }

  completeOAuthImap(provider: 'google' | 'microsoft', code: string, state: string): Observable<CommunicationSyncConfigSummary> {
    return this.http.post<CommunicationSyncConfigSummary>(
      `${this.baseUrl}/oauth/imap/${provider}/complete`,
      { code, state },
    ).pipe(tap(() => this.loadConnections()));
  }

  disconnect(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/connections/${id}`).pipe(
      tap(() => this.loadConnections()),
    );
  }

  syncNow(id: number): Observable<{ id: number; eventCount: number; syncedAt: string }> {
    this.syncing.update(s => new Set(s).add(id));
    return this.http.post<{ id: number; eventCount: number; syncedAt: string }>(
      `${this.baseUrl}/connections/${id}/sync`, {},
    ).pipe(
      tap(() => this.loadConnections()),
      finalize(() => this.syncing.update(s => {
        const next = new Set(s);
        next.delete(id);
        return next;
      })),
    );
  }
}
