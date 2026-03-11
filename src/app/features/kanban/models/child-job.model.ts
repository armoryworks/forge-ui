export interface ChildJob {
  id: number;
  jobNumber: string;
  title: string;
  stage: string;
  partNumber: string | null;
  quantity: number | null;
  createdAt: string;
}
