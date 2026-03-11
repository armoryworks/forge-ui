export interface OfflineQueueEntry {
  id: string;
  method: string;
  url: string;
  body: unknown;
  timestamp: number;
  description?: string;
}

export interface DrainResult {
  processed: number;
  failed: number;
  remaining: number;
}
