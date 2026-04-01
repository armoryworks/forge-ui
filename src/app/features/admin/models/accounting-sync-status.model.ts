export interface AccountingSyncStatus {
  connected: boolean;
  lastSyncAt: Date | null;
  queueDepth: number;
  failedCount: number;
}
