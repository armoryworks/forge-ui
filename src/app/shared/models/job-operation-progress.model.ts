import { JobOperationRow } from './job-operation-row.model';

export interface JobOperationProgress {
  operation: JobOperationRow;
  allOperationsComplete: boolean;
  estimatedRemainingMinutes: number | null;
}
