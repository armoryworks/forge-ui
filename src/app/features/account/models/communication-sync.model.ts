/**
 * Wave 8 — UI projection of the server's CommunicationSyncConfig row.
 * Tokens / refresh tokens never reach the client; the user only sees the
 * connection's display state + last-sync metadata.
 */
export interface CommunicationSyncConfigSummary {
  id: number;
  userId: number;
  kind: 'Email' | 'Voice';
  providerId: string;
  displayLabel: string | null;
  isConnected: boolean;
  externalAccountId: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommunicationSyncConfigRequest {
  kind: 'Email' | 'Voice';
  providerId: string;
  displayLabel: string | null;
  externalAccountId: string | null;
  configJson: string | null;
}

/**
 * Provider catalog the connect dialog reads from. Static today — adapter
 * implementations land in later phases (IMAP, Twilio, Gmail, MS Graph).
 * The Mock providers are connectable but make-believe; useful for dev
 * walkthrough and the matcher's smoke-test path.
 */
export interface CommunicationProviderInfo {
  providerId: string;
  kind: 'Email' | 'Voice';
  displayName: string;
  description: string;
  icon: string;
  // Tag indicating implementation status — informs UI badge.
  status: 'available' | 'mock' | 'planned';
}
