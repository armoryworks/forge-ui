export interface OidcProvisionClientResponse {
  clientId: string;
  clientSecret: string;
  registrationAccessToken: string;
  issuedAt: string;
  clientName: string;
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  scopes: string[];
  status: 'Pending' | 'Active' | 'Suspended' | 'Revoked';
}
