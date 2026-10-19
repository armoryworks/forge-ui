/** A job with an open GL WIP balance and no production-cost close yet (`GET accounting/jobs/production-cost-close-candidates`). */
export interface JobCostCloseCandidate {
  jobId: number;
  jobNumber: string;
  title: string;
  completedDate: string | null;
  wipBalance: number;
  isComplete: boolean;
}

/** Outcome of `POST accounting/jobs/{jobId}/close-production-cost`. */
export interface JobProductionCostCloseResult {
  jobId: number;
  laborAbsorbed: number;
  overheadAbsorbed: number;
  productionVariance: number;
  posted: boolean;
  subcontractAbsorbed?: number;
}
