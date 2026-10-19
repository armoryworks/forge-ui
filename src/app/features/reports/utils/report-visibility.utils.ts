import { ReportType } from '../models/report-type.type';

export const SHOP_REPORT_ROLES = ['Admin', 'Manager', 'PM'];

const SELF_SERVICE_REPORTS: ReadonlySet<ReportType> = new Set<ReportType>([
  'my-work-history', 'my-time-log', 'my-expense-history', 'my-cycle-summary',
]);

export function isReportVisible(id: ReportType, canViewShopReports: boolean): boolean {
  return canViewShopReports || SELF_SERVICE_REPORTS.has(id);
}
