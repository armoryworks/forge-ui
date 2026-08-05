/**
 * Compact last-known capability snapshot persisted to localStorage by
 * `CapabilityService`. Only the gating decision (`code → enabled`) is kept —
 * ETags, config versions, and relation metadata are deliberately dropped so
 * the cached object stays a few KB (localStorage rule: minimal, no large
 * objects) and so stale ETags can never leak into optimistic-concurrency
 * writes. The cache is per-install (single-tenant per database), not
 * per-user, and is only a UX fallback — the server still enforces every
 * capability gate with a 403.
 */
export interface CapabilitySnapshotCache {
  /** `generatedAt` of the descriptor the cache was built from. */
  generatedAt: string;
  /** `code → enabled` at the time the descriptor was last fetched. */
  enabled: Record<string, boolean>;
}
