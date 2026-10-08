import { JobOperationRow } from './job-operation-row.model';
import { RunningTimer } from './running-timer.model';

export interface JobOperationTimerResult {
  entry: RunningTimer;
  alreadyRunning: boolean;
  operation: JobOperationRow;
}
