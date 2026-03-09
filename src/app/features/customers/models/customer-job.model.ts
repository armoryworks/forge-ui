export interface CustomerJob {
  id: number;
  jobNumber: string;
  title: string;
  stageName: string | null;
  stageColor: string | null;
  dueDate: string | null;
}
