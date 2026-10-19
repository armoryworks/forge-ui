export interface MaintenanceSchedule {
  id: number;
  assetId: number;
  assetName: string;
  title: string;
  description: string | null;
  intervalDays: number;
  intervalHours: number | null;
  intervalShots: number | null;
  lastPerformedAt: string | null;
  nextDueAt: string;
  isActive: boolean;
  isOverdue: boolean;
}

export interface CreateMaintenanceScheduleRequest {
  assetId: number;
  title: string;
  description?: string;
  intervalDays: number;
  intervalHours?: number;
  intervalShots?: number;
  nextDueAt: string;
}

export interface LogMaintenanceRequest {
  hoursAtService?: number;
  shotCountAtService?: number;
  notes?: string;
  cost?: number;
}
