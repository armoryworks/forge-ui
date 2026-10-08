export interface KioskNextOperation {
  operationId: number;
  stepNumber: number;
  title: string;
  workCenterId: number | null;
  workCenterName: string | null;
}

export interface KioskAvailableJob {
  jobId: number;
  jobNumber: string;
  title: string;
  partNumber: string | null;
  quantity: number;
  dueDate: string | null;
  priorityName: string;
  stageName: string;
  nextOperation: KioskNextOperation | null;
}
