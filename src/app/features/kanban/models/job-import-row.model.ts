/** One CSV row of a job import, as the import endpoints take it. */
export interface JobImportRow {
  rowKey: string;
  jobNumber: string | null;
  title: string | null;
  customer: string | null;
  part: string | null;
  quantity: number | null;
  startDate: string | null;
  dueDate: string | null;
  completedDate: string | null;
  stage: string | null;
  trackType: string | null;
  priority: string | null;
  customerPO: string | null;
  description: string | null;
}
