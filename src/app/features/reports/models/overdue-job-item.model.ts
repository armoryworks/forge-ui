export interface OverdueJobItem {
  id: number;
  jobNumber: string;
  title: string;
  dueDate: Date;
  daysOverdue: number;
  assigneeName: string | null;
}
