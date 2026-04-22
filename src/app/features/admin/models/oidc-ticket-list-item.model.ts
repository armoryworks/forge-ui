import { OidcTicketStatus } from './oidc-ticket-status.model';

export interface OidcTicketListItem {
  id: number;
  ticketPrefix: string;
  expectedClientName: string;
  status: OidcTicketStatus;
  issuedAt: string;
  expiresAt: string;
  redeemedAt: string | null;
  issuedByUserId: number;
  allowedRedirectUriPrefix: string;
  allowedScopesCsv: string;
  requireSignedSoftwareStatement: boolean;
  resultingClientId: string | null;
  notes: string | null;
}
