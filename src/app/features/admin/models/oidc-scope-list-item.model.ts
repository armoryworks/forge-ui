export interface OidcScopeListItem {
  id: number;
  name: string;
  displayName: string;
  description: string;
  claimMappingsJson: string;
  resourcesCsv: string | null;
  isSystem: boolean;
  isActive: boolean;
}
