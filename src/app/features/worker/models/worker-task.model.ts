export interface WorkerTask {
  id: number;
  jobNumber: string;
  title: string;
  stageName: string;
  stageColor: string;
  priority: string;
  customerName: string | null;
  dueDate: Date | null;
  operationCount: number;
  operationsCompleted: number;
}
