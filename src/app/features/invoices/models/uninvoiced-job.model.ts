export interface UninvoicedJob {
  jobId: number;
  jobNumber: string;
  title: string;
  customerName: string | null;
  completedDate: string;
  customerId: number | null;
}
