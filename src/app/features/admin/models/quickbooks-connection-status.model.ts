export interface QuickBooksConnectionStatus {
  isConnected: boolean;
  companyId: string | null;
  companyName: string | null;
  connectedAt: Date | null;
  tokenExpiresAt: Date | null;
  lastSyncAt: Date | null;
}
