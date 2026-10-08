import { RunningTimer } from './running-timer.model';

export interface JobOperationTimerStop {
  stopped: boolean;
  entry: RunningTimer | null;
}
