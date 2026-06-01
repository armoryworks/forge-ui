/**
 * One row in the Connections registry — the federated admin view over every
 * credential / connection an install has issued or accepted.
 *
 * Rows are synthesized server-side by `IConnectionsRegistry`; each row deep-
 * links back to its native admin surface via `manageRoute`. The UI never
 * mutates via this registry — every operation routes back to the native page.
 *
 * Mirrors `forge.core/Models/IntegrationRecordResponseModel.cs`.
 */
export type IntegrationKind =
  | 'BiApiKey'
  | 'SystemApiKey'
  | 'EdiTradingPartner'
  | 'QuickBooksOAuth'
  | 'CommunicationSync'
  | 'CloudStorageLink';

export interface IntegrationRecord {
  kind: IntegrationKind;
  sourceId: string;
  name: string;
  /** Bound user email for user-scoped rows; null for install-level / unbound. */
  ownerEmail: string | null;
  status: string;
  lastUsedAt: string | null;
  /** Null for sources without a creation timestamp (QuickBooks OAuth, today). */
  createdAt: string | null;
  manageRoute: string;
}
