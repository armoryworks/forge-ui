/**
 * Names a change queued offline for the sync sheet: a translation key plus
 * the job or part number known when it was queued, never a database id.
 */
export interface QueuedActionLabel {
  key: string;
  params?: Record<string, string | number>;
}
