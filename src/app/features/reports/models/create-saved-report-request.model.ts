import { ReportFilter, ReportChartType } from './report-builder.model';

export interface CreateSavedReportRequest {
  name: string;
  description?: string;
  entitySource: string;
  columns: string[];
  filters: ReportFilter[];
  groupByField?: string;
  sortField?: string;
  sortDirection?: string;
  chartType?: ReportChartType;
  chartLabelField?: string;
  chartValueField?: string;
  isShared: boolean;
}
