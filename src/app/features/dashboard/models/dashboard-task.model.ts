export interface DashboardTask {
  id: number;
  time: string;
  title: string;
  jobNumber: string;
  barColor: string;
  assignee: { initials: string; color: string };
  status: string;
  statusColor: 'active' | 'upcoming' | 'overdue' | 'completed';
}
