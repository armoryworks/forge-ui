export interface RunningTimer {
  id: number;
  jobId: number | null;
  jobNumber: string | null;
  userId: number;
  timerStart: string | null;
  operationId: number | null;
  jobOperationId: number | null;
  operationStepNumber: number | null;
  operationTitle: string | null;
  entryType: string | null;
}
