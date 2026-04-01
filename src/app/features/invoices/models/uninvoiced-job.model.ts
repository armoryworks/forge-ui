export interface UninvoicedJob {
  jobId: number;
  jobNumber: string;
  title: string;
  customerName: string | null;
  completedDate: Date;
  customerId: number | null;
}
