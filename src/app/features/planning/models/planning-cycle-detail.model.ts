import { PlanningCycleEntry } from './planning-cycle-entry.model';

export interface PlanningCycleDetail {
  id: number;
  name: string;
  startDate: Date;
  endDate: Date;
  goals: string | null;
  status: string;
  durationDays: number;
  entries: PlanningCycleEntry[];
  createdAt: Date;
  updatedAt: Date;
}
