/** A queued change the server refused on replay; it needs a person on the desktop. */
export interface RejectedQueueEntry {
  id: string;
  description: string;
  status: number;
  message: string;
  timestamp: number;
}
