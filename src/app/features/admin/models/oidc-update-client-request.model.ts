export interface OidcUpdateClientRequest {
  requireConsent: boolean;
  isFirstParty: boolean;
  requiredRolesCsv: string | null;
  allowedCustomScopesCsv: string | null;
  description: string | null;
  ownerEmail: string | null;
  notes: string | null;
}
