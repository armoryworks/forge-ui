import { JobOperationRow } from './job-operation-row.model';

export interface JobOperationProgressResult {
  operation: JobOperationRow;
  allOperationsComplete: boolean;
  estimatedRemainingMinutes: number | null;
}
