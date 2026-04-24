export interface OidcProvisionClientRequest {
  clientName: string;
  redirectUris: string[];
  postLogoutRedirectUris?: string[];
  scopes: string[];
  approveImmediately: boolean;
  isFirstParty: boolean;
  requireConsent: boolean;
  requiredRolesCsv?: string;
  ownerEmail?: string;
  description?: string;
  notes?: string;
}
