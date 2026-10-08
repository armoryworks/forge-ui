import { RunningTimer } from './running-timer.model';

/** `queuedId` is set when the stop was queued offline rather than sent. */
export interface OperationTimerStopOutcome {
  stopped: RunningTimer;
  queuedId: string | null;
}
