import { PlanningCycleEntry } from './planning-cycle-entry.model';

export interface PlanningCycleDetail {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  goals: string | null;
  status: string;
  durationDays: number;
  entries: PlanningCycleEntry[];
  createdAt: string;
  updatedAt: string;
}
