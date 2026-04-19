export interface SalesOrderLineJob {
  id: number;
  jobNumber: string;
  title: string | null;
  stageName: string | null;
  assigneeName: string | null;
  priority: string | null;
  dueDate: Date | null;
  isArchived: boolean;
}
