export interface SyncResult {
  processed: number;
  failed: number;
  remaining: number;
  success: boolean;
  timestamp: number;
}
