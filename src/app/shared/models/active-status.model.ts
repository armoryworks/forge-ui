import { StatusEntry } from './status-entry.model';

export interface ActiveStatus {
  workflowStatus: StatusEntry | null;
  activeHolds: StatusEntry[];
}
