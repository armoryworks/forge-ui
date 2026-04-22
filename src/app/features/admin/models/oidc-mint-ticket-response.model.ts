export interface OidcMintTicketResponse {
  ticketId: number;
  rawTicket: string;
  ticketPrefix: string;
  issuedAt: string;
  expiresAt: string;
  allowedRedirectUriPrefix: string;
  allowedScopes: string[];
}
