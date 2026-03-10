export interface CreatePlanningCycleRequest {
  name: string;
  startDate: string;
  endDate: string;
  goals?: string;
  durationDays?: number;
}
