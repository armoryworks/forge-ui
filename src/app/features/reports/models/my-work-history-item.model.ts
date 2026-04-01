export interface MyWorkHistoryItem {
  jobId: number;
  jobNumber: string;
  title: string;
  stageName: string;
  stageColor: string | null;
  customerName: string | null;
  dueDate: Date | null;
  createdAt: Date;
  completedAt: Date | null;
}
