import { OidcAuditEventType } from './oidc-audit-event-type.model';

export interface OidcAuditEventListItem {
  id: number;
  eventType: OidcAuditEventType;
  actorUserId: number | null;
  actorIpAddress: string | null;
  clientId: string | null;
  ticketId: number | null;
  scopeName: string | null;
  detailsJson: string | null;
  createdAt: string;
}
