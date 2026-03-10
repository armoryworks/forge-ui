export interface CreateScheduledTaskRequest {
  name: string;
  description?: string;
  trackTypeId: number;
  internalProjectTypeId?: number;
  assigneeId?: number;
  cronExpression: string;
}
