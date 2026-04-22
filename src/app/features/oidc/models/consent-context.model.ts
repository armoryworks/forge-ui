export interface ConsentScopeDescriptor {
  name: string;
  displayName: string;
  description: string;
  isSystem: boolean;
}

export interface ConsentContextResponse {
  clientId: string;
  clientDisplayName: string | null;
  clientDescription: string | null;
  ownerEmail: string | null;
  isFirstParty: boolean;
  scopes: ConsentScopeDescriptor[];
}
