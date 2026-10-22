import { LaborRecomputeJobChange } from './labor-recompute-job-change.model';

export interface LaborRecomputeResult {
  applied: boolean;
  entriesChanged: number;
  lockedSkipped: number;
  laborMinutesBefore: number;
  laborMinutesAfter: number;
  costBefore: number;
  costAfter: number;
  jobs: LaborRecomputeJobChange[];
}
