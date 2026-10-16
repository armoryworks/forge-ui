export interface WorkerJobListItem {
  id: number;
  jobNumber: string;
  title: string;
  stageName: string;
  stageColor: string;
  priorityName: string;
  customerName: string | null;
  dueDate: string | null;
  operationsTotal: number | null;
  operationsComplete: number | null;
}
