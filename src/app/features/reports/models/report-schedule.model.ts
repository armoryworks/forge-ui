export type ReportExportFormat = 'Pdf' | 'Csv' | 'Xlsx';

export interface ReportSchedule {
  id: number;
  savedReportId: number;
  reportName: string;
  cronExpression: string;
  recipientEmailsJson: string;
  format: ReportExportFormat;
  isActive: boolean;
  lastSentAt: string | null;
  nextRunAt: string | null;
  subjectTemplate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReportScheduleRequest {
  savedReportId: number;
  cronExpression: string;
  recipientEmailsJson: string;
  format: ReportExportFormat;
  subjectTemplate: string | null;
}

export interface ReportScheduleRunResult {
  scheduleId: number;
  recipientCount: number;
}
