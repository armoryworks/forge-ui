/**
 * User-bound system API keys — admin issuance surface. Mirrors the server-side
 * response models in `forge.api/Features/SystemApiKeys/`. Plaintext is only
 * returned ONCE at issuance via `CreateSystemApiKeyResponse.plaintextKey`;
 * subsequent reads only see the prefix.
 *
 * Distinct from BiApiKey: SystemApiKey authenticates AS a real ApplicationUser
 * (request principal carries the user's id + roles, audit rows attribute to
 * that user), so every key has a bound `userId` / `userEmail`.
 */
export interface SystemApiKey {
  id: number;
  name: string;
  keyPrefix: string;
  userId: number;
  userEmail: string | null;
  isActive: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  scopes: string[] | null;
  allowedIps: string[] | null;
  createdAt: string;

  /**
   * Optional role-template binding. When set, the auth handler narrows the
   * bound user's role set to the intersection of (user roles) ∩ (template
   * IncludedRoleNames). When null, the key inherits the user's full grants.
   */
  roleTemplateId: number | null;
  /** Denormalized for the list display; null when no template is bound. */
  roleTemplateName: string | null;
}

export interface CreateSystemApiKeyRequest {
  name: string;
  userId: number;
  expiresAt?: string | null;
  scopes?: string[] | null;
  allowedIps?: string[] | null;

  /**
   * Optional role-template id. When set, the key's effective role set at
   * auth time is the intersection of (bound user's roles) ∩ (template's
   * IncludedRoleNames) — the template can only narrow, never expand. When
   * null/omitted, the key inherits the user's full grant set.
   */
  roleTemplateId?: number | null;
}

/**
 * Issuance response — `plaintextKey` is the only place the full key is ever
 * exposed; once dismissed it cannot be recovered (the server stores only the
 * PBKDF2 hash + prefix). Surface a one-time copy + warning UX.
 */
export interface CreateSystemApiKeyResponse {
  id: number;
  name: string;
  keyPrefix: string;
  plaintextKey: string;
  userId: number;
  expiresAt: string | null;
}
