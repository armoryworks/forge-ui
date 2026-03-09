export interface OverdueJobItem {
  id: number;
  jobNumber: string;
  title: string;
  dueDate: string;
  daysOverdue: number;
  assigneeName: string | null;
}
