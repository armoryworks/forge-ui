export interface OidcMintTicketRequest {
  expectedClientName: string;
  allowedRedirectUriPrefix: string;
  allowedPostLogoutRedirectUriPrefix: string | null;
  allowedScopes: string[];
  requiredRolesForUsers: string[] | null;
  ttlHours: number;
  requireSignedSoftwareStatement: boolean;
  trustedPublisherKeyIds: string[] | null;
  notes: string | null;
}
