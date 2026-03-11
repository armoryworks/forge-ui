export interface ReportEntityDefinition {
  entitySource: string;
  label: string;
  fields: ReportFieldDefinition[];
}

export interface ReportFieldDefinition {
  field: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'enum';
  isFilterable: boolean;
  isSortable: boolean;
  isGroupable: boolean;
}

export type ReportFilterOperator =
  | 'Equals'
  | 'NotEquals'
  | 'Contains'
  | 'StartsWith'
  | 'GreaterThan'
  | 'LessThan'
  | 'GreaterThanOrEqual'
  | 'LessThanOrEqual'
  | 'Between'
  | 'IsNull'
  | 'IsNotNull'
  | 'In';

export interface ReportFilter {
  field: string;
  operator: ReportFilterOperator;
  value?: string;
  value2?: string;
}

export type ReportChartType = 'bar' | 'line' | 'pie' | 'doughnut' | 'table';

export interface SavedReport {
  id: number;
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
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface RunReportResponse {
  columns: string[];
  rows: Record<string, unknown>[];
  totalCount: number;
  groupedData?: Record<string, Record<string, unknown>[]>;
}
