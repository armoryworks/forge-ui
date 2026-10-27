export interface ProjectJob {
  jobId: number;
  jobNumber: string;
  title: string;
  stageName: string | null;
  stageColor: string | null;
  dueDate: string | null;
  completedDate: string | null;
  wbsElementId: number;
  wbsCode: string;
  wbsName: string;
}
