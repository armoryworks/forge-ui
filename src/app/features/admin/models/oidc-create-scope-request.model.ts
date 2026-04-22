export interface OidcCreateScopeRequest {
  name: string;
  displayName: string;
  description: string;
  claimMappingsJson: string;
  resourcesCsv: string | null;
}
