export interface EmployeeProductivityItem {
  userId: number;
  userName: string;
  totalHours: number;
  jobsCompleted: number;
  avgHoursPerJob: number;
  onTimePercentage: number;
}
