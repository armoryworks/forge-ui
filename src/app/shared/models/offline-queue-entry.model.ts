export interface OfflineQueueEntry {
  id: string;
  method: string;
  url: string;
  body: unknown;
  timestamp: number;
  description?: string;
  /** Replayed verbatim — carries the Idempotency-Key the request was minted with. */
  headers?: Record<string, string>;
  /** Mobile shell: the instance this entry belongs to; drained only while that instance is active. */
  instanceId?: string | null;
}

export interface DrainResult {
  processed: number;
  failed: number;
  remaining: number;
}
