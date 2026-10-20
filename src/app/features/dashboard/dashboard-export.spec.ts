import { describe, expect, it } from 'vitest';

import { dashboardCsvRows } from './dashboard-export';
import { DashboardData } from './models/dashboard-data.model';

const labels: Record<string, string> = {
  'dashboard.export.section': 'Section',
  'dashboard.export.field': 'Field',
  'dashboard.export.value': 'Value',
  'dashboard.export.kpis': 'KPIs',
  'dashboard.export.activeJobs': 'Active Work Orders',
  'dashboard.export.overdueJobs': 'Overdue Work Orders',
  'dashboard.export.totalHours': 'Total Hours',
  'dashboard.export.status': 'Status',
  'dashboard.export.count': 'Count',
  'dashboard.export.teamMember': 'Team Member',
  'dashboard.export.taskCount': 'Task Count',
  'dashboard.export.dueDate': 'Due Date',
  'dashboard.export.jobNumber': 'Work Order #',
  'dashboard.export.title': 'Title',
  'dashboard.export.overdue': 'Overdue',
  'common.yes': 'Yes',
  'common.no': 'No',
};

const data = {
  tasks: [],
  stages: [{ label: 'In Production', count: 3 }],
  team: [{ name: 'Sam, Lee', taskCount: 2 }],
  activity: [],
  deadlines: [
    { date: 'Nov 3', dueDate: '2026-11-03', jobNumber: 'J-4', description: 'Bracket "A" run', isOverdue: false },
  ],
  kpis: {
    activeCount: 5, activeChange: 0, overdueCount: 1, overdueChange: 0,
    totalHours: '6m', totalHoursValue: 0.1, hoursStatus: 'up',
  },
} as unknown as DashboardData;

describe('dashboardCsvRows', () => {
  const rows = dashboardCsvRows(data, key => labels[key] ?? key);

  it('writes translated headers that follow the install terms', () => {
    expect(rows[1]).toEqual(['KPIs', 'Active Work Orders', 5]);
    expect(rows).toContainEqual(['Due Date', 'Work Order #', 'Title', 'Overdue']);
  });

  it('writes numeric hours and ISO due dates instead of display strings', () => {
    expect(rows[3]).toEqual(['KPIs', 'Total Hours', 0.1]);
    expect(rows[rows.length - 1]).toEqual(['2026-11-03', 'J-4', 'Bracket "A" run', 'No']);
  });

  it('keeps a team member name with a comma as one cell', () => {
    expect(rows).toContainEqual(['Sam, Lee', 2]);
  });
});
