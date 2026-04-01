export interface ScheduledTask {
  id: number;
  name: string;
  description: string | null;
  trackTypeId: number;
  trackTypeName: string;
  internalProjectTypeId: number | null;
  assigneeId: number | null;
  cronExpression: string;
  isActive: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  createdAt: Date;
}
