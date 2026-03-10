export interface QuickBooksConnectionStatus {
  isConnected: boolean;
  companyId: string | null;
  companyName: string | null;
  connectedAt: string | null;
  tokenExpiresAt: string | null;
  lastSyncAt: string | null;
}
