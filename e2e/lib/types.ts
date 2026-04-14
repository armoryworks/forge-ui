import type { StressRole, TeamId } from './fixtures';

export type WorkerStatus = 'initializing' | 'running' | 'paused' | 'failed' | 'completed';

export interface WorkerState {
  workerId: number;
  email: string;
  role: StressRole;
  team: TeamId;
  status: WorkerStatus;
  currentStep: string;
  currentScript: string;
  loopCount: number;
  stepCount: number;
  errorCount: number;
  lastError: string | null;
  lastErrorAt: Date | null;
  startedAt: Date;
  signalrEvents: number;
  chatMessages: number;
  avgResponseMs: number;
  /** Tracks data created by this worker: entity type → count */
  dataCreated: Record<string, number>;
}

export interface StressMetrics {
  totalActions: number;
  totalErrors: number;
  totalLoops: number;
  signalrEvents: number;
  chatMessages: number;
  notificationsSent: number;
  conflicts409: number;
  deadlocks: number;
  avgResponseMs: number;
  p95ResponseMs: number;
  p99ResponseMs: number;
  startedAt: Date;
  workers: WorkerState[];
}

export interface StepResult {
  stepId: string;
  stepName: string;
  success: boolean;
  durationMs: number;
  error?: string;
  screenshot?: string;
  /** Data created during this step (e.g., 'job', 'expense', 'lead') */
  dataCreated?: string;
}

export interface WorkflowError {
  workerId: number;
  email: string;
  stepId: string;
  stepName: string;
  script: string;
  error: string;
  stack?: string;
  screenshot?: string;
  timestamp: Date;
  loopNumber: number;
}
