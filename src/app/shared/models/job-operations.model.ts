import { JobOperationRow } from './job-operation-row.model';

export interface JobOperations {
  jobId: number;
  jobQuantity: number;
  trackingEnabled: boolean;
  allOperationsComplete: boolean;
  estimatedRemainingMinutes: number | null;
  serverNow: string;
  operations: JobOperationRow[];
}
