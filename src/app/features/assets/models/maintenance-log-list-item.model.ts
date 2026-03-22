export interface MaintenanceLogListItem {
  id: number;
  scheduleName: string;
  performedAt: string;
  performedByName: string;
  hoursSpent: number | null;
  notes: string | null;
  cost: number | null;
}
