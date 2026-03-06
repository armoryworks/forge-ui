import {
  ActivityEntry,
  DashboardTask,
  DeadlineEntry,
  StageCount,
  TeamMember,
} from '../models/dashboard.model';

export const MOCK_TASKS: DashboardTask[] = [
  { time: '8:00a', title: 'CNC setup — Bracket Assy Rev C', jobNumber: 'J-1042', barColor: '#0d9488', assignee: { initials: 'AK', color: '#6366f1' }, status: 'Active', statusColor: 'active' },
  { time: '8:00a', title: 'Material prep — Shaft Housing', jobNumber: 'J-1038', barColor: '#8b5cf6', assignee: { initials: 'DH', color: '#0d9488' }, status: 'Active', statusColor: 'active' },
  { time: '8:30a', title: 'QC inspection — Motor Mount v2', jobNumber: 'J-1035', barColor: '#f59e0b', assignee: { initials: 'JS', color: '#ec4899' }, status: 'Active', statusColor: 'active' },
  { time: '9:00a', title: 'Weld fixture alignment check', jobNumber: 'J-1041', barColor: '#0d9488', assignee: { initials: 'MR', color: '#f59e0b' }, status: 'Next', statusColor: 'upcoming' },
  { time: '9:00a', title: 'Program verify — Plate Adapter', jobNumber: 'J-1039', barColor: '#ec4899', assignee: { initials: 'AK', color: '#6366f1' }, status: 'Next', statusColor: 'upcoming' },
  { time: '9:30a', title: 'Deburr & finish — Gear Blank', jobNumber: 'J-1033', barColor: '#6366f1', assignee: { initials: 'DH', color: '#0d9488' }, status: 'Next', statusColor: 'upcoming' },
  { time: '10:00a', title: 'Tool change — End Mill #4 replace', jobNumber: 'J-1042', barColor: '#0d9488', assignee: { initials: 'JS', color: '#ec4899' }, status: 'Next', statusColor: 'upcoming' },
  { time: '10:00a', title: 'First article inspection — Flange', jobNumber: 'J-1040', barColor: '#f59e0b', assignee: { initials: 'MR', color: '#f59e0b' }, status: 'Next', statusColor: 'upcoming' },
  { time: '10:30a', title: 'Assembly — Pneumatic Manifold', jobNumber: 'J-1036', barColor: '#8b5cf6', assignee: { initials: 'AK', color: '#6366f1' }, status: 'Next', statusColor: 'upcoming' },
  { time: '11:00a', title: 'Surface grind — Dowel Plate', jobNumber: 'J-1037', barColor: '#ec4899', assignee: { initials: 'DH', color: '#0d9488' }, status: 'Next', statusColor: 'upcoming' },
  { time: '11:00a', title: 'Anodize prep — Heat Sink Array', jobNumber: 'J-1044', barColor: '#6366f1', assignee: { initials: 'JS', color: '#ec4899' }, status: 'Next', statusColor: 'upcoming' },
  { time: '11:30a', title: 'Drill & tap — Mounting Block', jobNumber: 'J-1045', barColor: '#0d9488', assignee: { initials: 'MR', color: '#f59e0b' }, status: 'Next', statusColor: 'upcoming' },
  { time: '1:00p', title: 'EDM programming — Die Insert', jobNumber: 'J-1046', barColor: '#8b5cf6', assignee: { initials: 'AK', color: '#6366f1' }, status: 'Next', statusColor: 'upcoming' },
  { time: '1:00p', title: 'Laser mark — Serial plates (50pc)', jobNumber: 'J-1034', barColor: '#f59e0b', assignee: { initials: 'DH', color: '#0d9488' }, status: 'Late', statusColor: 'overdue' },
  { time: '1:30p', title: 'CMM run — Bracket Assy final', jobNumber: 'J-1042', barColor: '#0d9488', assignee: { initials: 'JS', color: '#ec4899' }, status: 'Next', statusColor: 'upcoming' },
  { time: '2:00p', title: 'Pack & ship — Acme Order #889', jobNumber: 'J-1031', barColor: '#ec4899', assignee: { initials: 'MR', color: '#f59e0b' }, status: 'Late', statusColor: 'overdue' },
  { time: '2:00p', title: 'Wire EDM — Punch Tool blank', jobNumber: 'J-1047', barColor: '#6366f1', assignee: { initials: 'AK', color: '#6366f1' }, status: 'Next', statusColor: 'upcoming' },
  { time: '2:30p', title: 'Tumble finish — Small parts lot', jobNumber: 'J-1048', barColor: '#8b5cf6', assignee: { initials: 'DH', color: '#0d9488' }, status: 'Next', statusColor: 'upcoming' },
  { time: '3:00p', title: 'Final QC — Pneumatic Manifold', jobNumber: 'J-1036', barColor: '#8b5cf6', assignee: { initials: 'JS', color: '#ec4899' }, status: 'Next', statusColor: 'upcoming' },
  { time: '3:30p', title: 'Machine clean & PM — Haas VF-2', jobNumber: 'M-0012', barColor: '#f59e0b', assignee: { initials: 'MR', color: '#f59e0b' }, status: 'Next', statusColor: 'upcoming' },
  { time: '4:00p', title: 'End of day report & tomorrow prep', jobNumber: 'INT-03', barColor: '#0d9488', assignee: { initials: 'DH', color: '#0d9488' }, status: 'Next', statusColor: 'upcoming' },
];

export const MOCK_STAGES: StageCount[] = [
  { label: 'Quoting', count: 3, color: '#6366f1', maxCount: 12 },
  { label: 'Planning', count: 5, color: '#8b5cf6', maxCount: 12 },
  { label: 'Materials', count: 4, color: '#a855f7', maxCount: 12 },
  { label: 'Production', count: 12, color: '#0d9488', maxCount: 12 },
  { label: 'QC', count: 3, color: '#f59e0b', maxCount: 12 },
  { label: 'Shipping', count: 2, color: '#ec4899', maxCount: 12 },
  { label: 'Complete', count: 8, color: '#6b7280', maxCount: 12 },
];

export const MOCK_TEAM: TeamMember[] = [
  { initials: 'AK', name: 'A. Kim', color: '#6366f1', taskCount: 6, maxTasks: 8 },
  { initials: 'DH', name: 'D. Hart', color: '#0d9488', taskCount: 5, maxTasks: 8 },
  { initials: 'JS', name: 'J. Silva', color: '#ec4899', taskCount: 4, maxTasks: 8 },
  { initials: 'MR', name: 'M. Reyes', color: '#f59e0b', taskCount: 4, maxTasks: 8 },
];

export const MOCK_ACTIVITY: ActivityEntry[] = [
  { icon: 'arrow_forward', iconColor: '#0d9488', text: '<b>J-1042</b> moved to Production', time: '10m ago' },
  { icon: 'person_add', iconColor: '#6366f1', text: '<b>A. Kim</b> assigned to <b>J-1044</b>', time: '25m ago' },
  { icon: 'attach_file', iconColor: '#8b5cf6', text: 'Drawing uploaded to <b>J-1038</b>', time: '1h ago' },
  { icon: 'check_circle', iconColor: '#15803d', text: '<b>J-1030</b> passed QC inspection', time: '2h ago' },
  { icon: 'schedule', iconColor: '#f59e0b', text: '<b>J-1034</b> overdue — was due yesterday', time: '3h ago' },
];

export const MOCK_DEADLINES: DeadlineEntry[] = [
  { date: 'Mar 6', jobNumber: 'J-1034', description: 'Serial plates — Laser mark', isOverdue: true },
  { date: 'Mar 6', jobNumber: 'J-1031', description: 'Acme Order — Pack & ship', isOverdue: true },
  { date: 'Mar 7', jobNumber: 'J-1042', description: 'Bracket Assy Rev C — Final', isOverdue: false },
  { date: 'Mar 10', jobNumber: 'J-1038', description: 'Shaft Housing — Delivery', isOverdue: false },
  { date: 'Mar 12', jobNumber: 'J-1036', description: 'Pneumatic Manifold — Ship', isOverdue: false },
];
