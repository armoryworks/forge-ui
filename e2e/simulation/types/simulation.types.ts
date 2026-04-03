import type { SimError } from '../helpers/sim-context.helper';

export interface WeekContext {
  /** Start of the simulated week (Monday 00:00 UTC) */
  weekStart: Date;
  /** End of the simulated week (Sunday 23:59 UTC) */
  weekEnd: Date;
  /** Week index from the simulation start date (0-based) */
  weekIndex: number;
  /** ISO week label for logging e.g. "2024-W01" */
  weekLabel: string;
  /** Auth tokens keyed by role email */
  tokens: Record<string, string>;
}

export interface WeekResult {
  weekLabel: string;
  weekStart: string;
  actionsAttempted: number;
  actionsSucceeded: number;
  errors: SimError[];
  durationMs: number;
}

export interface SimulationReport {
  startedAt: string;
  completedAt: string;
  totalWeeks: number;
  totalActions: number;
  totalErrors: number;
  weeks: WeekResult[];
}
