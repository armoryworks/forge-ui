export interface CustomerActivityItem {
  customerId: number;
  customerName: string;
  activeJobs: number;
  completedJobs: number;
  totalJobs: number;
  lastJobDate: string | null;
}
