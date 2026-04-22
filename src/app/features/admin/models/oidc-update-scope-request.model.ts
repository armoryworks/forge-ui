export interface OidcUpdateScopeRequest {
  displayName: string;
  description: string;
  claimMappingsJson: string;
  resourcesCsv: string | null;
  isActive: boolean;
}
