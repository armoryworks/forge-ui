export interface OidcRotateSecretResponse {
  clientId: string;
  newClientSecret: string;
  rotatedAt: string;
}
