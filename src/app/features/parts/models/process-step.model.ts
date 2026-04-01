export interface ProcessStep {
  id: number;
  partId: number;
  stepNumber: number;
  title: string;
  instructions: string | null;
  workCenterId: number | null;
  workCenterName: string | null;
  estimatedMinutes: number | null;
  isQcCheckpoint: boolean;
  qcCriteria: string | null;
  createdAt: Date;
  updatedAt: Date;
}
