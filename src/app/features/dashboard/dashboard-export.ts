import { DashboardData } from './models/dashboard-data.model';

export function buildDashboardCsv(data: DashboardData, t: (key: string) => string): string {
  const row = (...cells: (string | number)[]) => cells.map(csvCell).join(',');
  const lines = [
    row(t('dashboard.export.section'), t('dashboard.export.field'), t('dashboard.export.value')),
    row(t('dashboard.export.kpis'), t('dashboard.export.activeJobs'), data.kpis.activeCount),
    row(t('dashboard.export.kpis'), t('dashboard.export.overdueJobs'), data.kpis.overdueCount),
    row(t('dashboard.export.kpis'), t('dashboard.export.totalHours'), data.kpis.totalHoursValue ?? data.kpis.totalHours),
    '',
    row(t('dashboard.export.status'), t('dashboard.export.count')),
    ...data.stages.map(s => row(s.label, s.count)),
    '',
    row(t('dashboard.export.teamMember'), t('dashboard.export.taskCount')),
    ...data.team.map(m => row(m.name, m.taskCount)),
    '',
    row(t('dashboard.export.dueDate'), t('dashboard.export.jobNumber'), t('dashboard.export.title'), t('dashboard.export.overdue')),
    ...data.deadlines.map(d => row(
      d.dueDate ?? d.date, d.jobNumber, d.description, t(d.isOverdue ? 'common.yes' : 'common.no'),
    )),
  ];
  return lines.join('\n');
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
