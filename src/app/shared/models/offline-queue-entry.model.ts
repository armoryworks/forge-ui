export interface OfflineQueueEntry {
  id: string;
  method: string;
  url: string;
  body: unknown;
  timestamp: number;
}

export interface DrainResult {
  processed: number;
  failed: number;
  remaining: number;
}
