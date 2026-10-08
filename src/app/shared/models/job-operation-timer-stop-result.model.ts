import { TimeEntry } from '../../features/time-tracking/models/time-entry.model';

export interface JobOperationTimerStopResult {
  stopped: boolean;
  entry: TimeEntry | null;
}
