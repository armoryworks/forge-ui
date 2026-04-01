export interface RdReportItem {
  jobId: number;
  jobNumber: string;
  title: string;
  iterationCount: number;
  totalHours: number;
  currentStage: string;
  assigneeName: string | null;
  startDate: Date | null;
  completedDate: Date | null;
}
