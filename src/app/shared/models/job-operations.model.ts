import { JobOperationRow } from './job-operation-row.model';

export interface JobOperations {
  jobId: number;
  jobQuantity: number;
  targetQuantity?: number | null;
  trackingEnabled: boolean;
  allOperationsComplete: boolean;
  estimatedRemainingMinutes: number | null;
  serverNow: string;
  operations: JobOperationRow[];
  quantityDecimalPlaces?: number | null;
}
