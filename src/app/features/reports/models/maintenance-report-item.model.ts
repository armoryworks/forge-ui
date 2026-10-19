export interface MaintenanceReportItem {
  assetId: number;
  assetName: string;
  scheduledCount: number;
  completedCount: number;
  overdueCount: number;
  totalCost: number;
  downtimeEvents: number;
  failureCount: number;
  downtimeHours: number;
  unplannedDowntimeHours: number;
  mtbfHours: number | null;
}
