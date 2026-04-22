import { OidcClientStatus } from './oidc-client-status.model';

export interface OidcClientDetailResponse {
  clientId: string;
  displayName: string | null;
  status: OidcClientStatus;
  description: string | null;
  ownerEmail: string | null;
  requireConsent: boolean;
  isFirstParty: boolean;
  requiredRolesCsv: string | null;
  allowedCustomScopesCsv: string | null;
  createdAt: string;
  approvedAt: string | null;
  approvedByUserId: number | null;
  lastUsedAt: string | null;
  lastSecretRotatedAt: string | null;
  registrationTicketId: number | null;
  notes: string | null;
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  permissions: string[];
}
