export interface AccountingSyncStatus {
  connected: boolean;
  lastSyncAt: string | null;
  queueDepth: number;
  failedCount: number;
}
