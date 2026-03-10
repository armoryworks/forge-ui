export interface MaintenanceReportItem {
  assetId: number;
  assetName: string;
  scheduledCount: number;
  completedCount: number;
  overdueCount: number;
  totalCost: number;
}
