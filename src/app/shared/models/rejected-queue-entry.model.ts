import { QueuedActionLabel } from './queued-action-label.model';

/** A queued change the server refused on replay; it needs a person on the desktop. */
export interface RejectedQueueEntry {
  id: string;
  label: QueuedActionLabel;
  reasonKey: string;
  timestamp: number;
}
