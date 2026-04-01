export interface PlanningCycleListItem {
  id: number;
  name: string;
  startDate: Date;
  endDate: Date;
  status: string;
  totalJobs: number;
  completedJobs: number;
  createdAt: Date;
}
