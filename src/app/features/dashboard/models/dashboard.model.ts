export interface DashboardTask {
  time: string;
  title: string;
  jobNumber: string;
  barColor: string;
  assignee: { initials: string; color: string };
  status: string;
  statusColor: 'active' | 'upcoming' | 'overdue' | 'completed';
}

export interface StageCount {
  label: string;
  count: number;
  color: string;
  maxCount: number;
}

export interface TeamMember {
  initials: string;
  name: string;
  color: string;
  taskCount: number;
  maxTasks: number;
}

export interface ActivityEntry {
  icon: string;
  iconColor: string;
  text: string;
  time: string;
}

export interface DeadlineEntry {
  date: string;
  jobNumber: string;
  description: string;
  isOverdue: boolean;
}

export interface DashboardKPIs {
  activeCount: number;
  activeChange: number;
  overdueCount: number;
  overdueChange: number;
  totalHours: string;
  hoursStatus: string;
}

export interface DashboardData {
  tasks: DashboardTask[];
  stages: StageCount[];
  team: TeamMember[];
  activity: ActivityEntry[];
  deadlines: DeadlineEntry[];
  kpis: DashboardKPIs;
}
