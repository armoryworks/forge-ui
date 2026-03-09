import { ReportType } from './report-type.type';

export interface ReportDef {
  id: ReportType;
  label: string;
  icon: string;
  needsDateRange: boolean;
}
