export interface MaintenanceLogListItem {
  id: number;
  scheduleName: string;
  performedAt: Date;
  performedByName: string;
  hoursSpent: number | null;
  notes: string | null;
  cost: number | null;
}
