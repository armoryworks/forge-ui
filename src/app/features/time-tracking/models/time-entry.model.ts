export interface TimeEntry {
  id: number;
  jobId: number | null;
  jobNumber: string | null;
  userId: number;
  userName: string;
  date: Date;
  durationMinutes: number;
  category: string | null;
  notes: string | null;
  timerStart: Date | null;
  timerStop: Date | null;
  isManual: boolean;
  isLocked: boolean;
  isBillable?: boolean;
  createdAt: Date;
  operationId?: number | null;
  jobOperationId?: number | null;
  operationStepNumber?: number | null;
  operationTitle?: string | null;
  entryType?: string | null;
  laborMinutes?: number | null;
  allocationMethod?: string | null;
}
