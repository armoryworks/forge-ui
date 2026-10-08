import { JobOperationRow } from './job-operation-row.model';
import { TimeEntry } from '../../features/time-tracking/models/time-entry.model';

export interface JobOperationTimerResult {
  entry: TimeEntry;
  alreadyRunning: boolean;
  operation: JobOperationRow;
}
