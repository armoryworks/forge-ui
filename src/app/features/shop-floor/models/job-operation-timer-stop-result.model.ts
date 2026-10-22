import { JobOperationRow } from './job-operation-row.model';
import { RunningTimer } from './running-timer.model';

export interface JobOperationTimerStopResult {
  stopped: boolean;
  entry: RunningTimer | null;
  operation?: JobOperationRow | null;
}
