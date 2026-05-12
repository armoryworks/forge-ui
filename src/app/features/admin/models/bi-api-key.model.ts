/**
 * Phase 3 / WU-04 retrofit — BI API key management surface for the admin
 * panel. Mirrors the server-side response models in
 * `forge.api/Features/Bi/`. No plaintext key field exists on
 * `BiApiKey` — plaintext is only returned ONCE on issuance via
 * `CreateBiApiKeyResponse.plaintextKey`.
 */
export interface BiApiKey {
  id: number;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  allowedEntitySets: string[] | null;
  allowedIps: string[] | null;
  createdAt: string;
}

export interface CreateBiApiKeyRequest {
  name: string;
  expiresAt?: string | null;
  allowedEntitySets?: string[] | null;
  allowedIps?: string[] | null;
}

/**
 * Issuance response — `plaintextKey` is the only place the full key is ever
 * exposed; once dismissed it cannot be recovered (the server stores only the
 * PBKDF2 hash + 12-char prefix). Surface a one-time copy + warning UX.
 */
export interface CreateBiApiKeyResponse {
  id: number;
  name: string;
  keyPrefix: string;
  plaintextKey: string;
  expiresAt: string | null;
}
