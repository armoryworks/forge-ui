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
}

export interface CreateSystemApiKeyRequest {
  name: string;
  userId: number;
  expiresAt?: string | null;
  scopes?: string[] | null;
  allowedIps?: string[] | null;

  /**
   * Forward-compat hook for per-key role-template scoping. The backend
   * silently ignores this today (auth derives from the bound user's roles),
   * but shipping the field now means the eventual scoping change is a
   * data-source swap in the form, not a payload-shape change. See
   * `docs/api-key-integrations.md` §1 — "per-key scope grants are tracked
   * as future work."
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
