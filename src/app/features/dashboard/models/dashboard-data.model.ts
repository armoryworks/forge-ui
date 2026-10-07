import { DashboardTask } from './dashboard-task.model';
import { StageCount } from './stage-count.model';
import { TeamMember } from './team-member.model';
import { ActivityEntry } from './activity-entry.model';
import { DeadlineEntry } from './deadline-entry.model';
import { DashboardKPIs } from './dashboard-kpis.model';

export interface DashboardData {
  tasks: DashboardTask[];
  stages: StageCount[];
  team: TeamMember[];
  activity: ActivityEntry[];
  deadlines: DeadlineEntry[];
  kpis: DashboardKPIs;
  customerCount: number;
  trackTypeCount: number;
  workCenterCount: number;
  partsWithOperationsCount: number;
  quoteCount: number;
  shipmentCount: number;
  totalJobCount: number;
}
