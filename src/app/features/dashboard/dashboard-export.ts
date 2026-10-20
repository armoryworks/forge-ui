import { DashboardData } from './models/dashboard-data.model';

export function dashboardCsvRows(data: DashboardData, t: (key: string) => string): unknown[][] {
  return [
    [t('dashboard.export.section'), t('dashboard.export.field'), t('dashboard.export.value')],
    [t('dashboard.export.kpis'), t('dashboard.export.activeJobs'), data.kpis.activeCount],
    [t('dashboard.export.kpis'), t('dashboard.export.overdueJobs'), data.kpis.overdueCount],
    [t('dashboard.export.kpis'), t('dashboard.export.totalHours'), data.kpis.totalHoursValue ?? data.kpis.totalHours],
    [],
    [t('dashboard.export.status'), t('dashboard.export.count')],
    ...data.stages.map(s => [s.label, s.count]),
    [],
    [t('dashboard.export.teamMember'), t('dashboard.export.taskCount')],
    ...data.team.map(m => [m.name, m.taskCount]),
    [],
    [t('dashboard.export.dueDate'), t('dashboard.export.jobNumber'), t('dashboard.export.title'), t('dashboard.export.overdue')],
    ...data.deadlines.map(d => [d.dueDate ?? d.date, d.jobNumber, d.description, t(d.isOverdue ? 'common.yes' : 'common.no')]),
  ];
}
