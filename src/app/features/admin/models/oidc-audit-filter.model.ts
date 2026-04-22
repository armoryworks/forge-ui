import { OidcAuditEventType } from './oidc-audit-event-type.model';

export interface OidcAuditFilter {
  eventType?: OidcAuditEventType;
  clientId?: string;
  ticketId?: number;
  actorUserId?: number;
  since?: string;
  until?: string;
  skip?: number;
  take?: number;
}
