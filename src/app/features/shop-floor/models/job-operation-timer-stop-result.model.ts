import { RunningTimer } from './running-timer.model';

export interface JobOperationTimerStopResult {
  stopped: boolean;
  entry: RunningTimer | null;
}
