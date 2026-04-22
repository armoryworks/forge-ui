import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { OidcAuditEventListItem } from '../../models/oidc-audit-event-list-item.model';
import { OidcAuditEventType } from '../../models/oidc-audit-event-type.model';

const EVENT_LABELS: Record<OidcAuditEventType, { label: string; category: 'ticket' | 'client' | 'consent' | 'runtime' | 'security' | 'scope' }> = {
  TicketIssued: { label: 'Registration ticket minted', category: 'ticket' },
  TicketRedeemed: { label: 'Ticket redeemed by client', category: 'ticket' },
  TicketExpired: { label: 'Ticket expired unused', category: 'ticket' },
  TicketRevoked: { label: 'Ticket revoked by admin', category: 'ticket' },
  ClientRegistered: { label: 'Client registered (Pending)', category: 'client' },
  ClientApproved: { label: 'Client approved → Active', category: 'client' },
  ClientSuspended: { label: 'Client suspended', category: 'client' },
  ClientRevoked: { label: 'Client revoked (terminal)', category: 'client' },
  ClientUpdated: { label: 'Client settings updated', category: 'client' },
  SecretRotated: { label: 'Client secret rotated', category: 'client' },
  RegistrationAccessTokenRotated: { label: 'Registration access token rotated', category: 'client' },
  ConsentGranted: { label: 'User granted consent', category: 'consent' },
  ConsentRevoked: { label: 'User revoked consent', category: 'consent' },
  ConsentDenied: { label: 'User denied consent', category: 'consent' },
  TokenIssued: { label: 'Access/refresh token issued', category: 'runtime' },
  AuthorizationCodeIssued: { label: 'Authorization code issued', category: 'runtime' },
  UserAuthenticated: { label: 'User authenticated at /connect/authorize', category: 'runtime' },
  RoleGateDenied: { label: 'Role gate denied access', category: 'security' },
  ScopeDenied: { label: 'Scope denied by policy', category: 'security' },
  RedirectUriMismatch: { label: 'Redirect URI did not match registration', category: 'security' },
  InvalidSoftwareStatement: { label: 'Software statement failed verification', category: 'security' },
  ScopeCreated: { label: 'Custom scope created', category: 'scope' },
  ScopeUpdated: { label: 'Custom scope updated', category: 'scope' },
  ScopeDeleted: { label: 'Custom scope deleted', category: 'scope' },
};

@Component({
  selector: 'app-oidc-audit-detail-dialog',
  standalone: true,
  imports: [DatePipe, DialogComponent],
  templateUrl: './oidc-audit-detail-dialog.component.html',
  styleUrl: './oidc-audit-detail-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OidcAuditDetailDialogComponent {
  readonly event = input.required<OidcAuditEventListItem>();
  readonly closed = output<void>();

  protected readonly meta = computed(() => EVENT_LABELS[this.event().eventType] ?? { label: this.event().eventType, category: 'runtime' as const });

  protected readonly prettyJson = computed(() => {
    const raw = this.event().detailsJson;
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return raw;
    }
  });

  protected close(): void {
    this.closed.emit();
  }

  protected categoryClass(): string {
    switch (this.meta().category) {
      case 'ticket': return 'chip chip--info';
      case 'client': return 'chip chip--primary';
      case 'consent': return 'chip chip--success';
      case 'runtime': return 'chip chip--muted';
      case 'security': return 'chip chip--error';
      case 'scope': return 'chip chip--warning';
    }
  }
}
