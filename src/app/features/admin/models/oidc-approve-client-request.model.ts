export interface OidcApproveClientRequest {
  isFirstParty: boolean;
  requireConsent: boolean;
  allowedCustomScopesCsv: string | null;
  requiredRolesCsv: string | null;
  notes: string | null;
}
