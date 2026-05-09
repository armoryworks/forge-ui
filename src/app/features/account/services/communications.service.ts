import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import {
  CommunicationProviderInfo,
  CommunicationSyncConfigSummary,
  CreateCommunicationSyncConfigRequest,
} from '../models/communication-sync.model';

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
      providerId: 'mock-voice',
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
      status: 'planned',
    },
    {
      providerId: 'gmail',
      kind: 'Email',
      displayName: 'Gmail',
      description: 'Google Workspace / Gmail with full label + history support.',
      icon: 'mark_email_read',
      status: 'planned',
    },
    {
      providerId: 'microsoft-graph',
      kind: 'Email',
      displayName: 'Microsoft 365',
      description: 'Outlook / Microsoft 365 mailbox via Graph API.',
      icon: 'forward_to_inbox',
      status: 'planned',
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

  disconnect(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/connections/${id}`).pipe(
      tap(() => this.loadConnections()),
    );
  }
}
