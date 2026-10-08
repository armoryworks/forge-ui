export interface LotTraceInspection {
  id: number;
  status: string;
  inspectorName: string;
  createdAt: Date;
  templateName?: string | null;
  completedAt?: Date | null;
  passedCount?: number;
  failedCount?: number;
}
