/** One versioned tier of this install. */
export interface DeployTier {
  service: string;
  running: string | null;
  configured: string | null;
  deployedAt: string | null;
}

/** One destructive DDL statement the schema reconcile refused to apply unattended. */
export interface DeployDestructiveStatement {
  number: number;
  statement: string;
}

export interface DeployApproval {
  statements: DeployDestructiveStatement[];
  preMigrateCommitted: boolean;
  dispositions: string[];
}

/** One box's leg of a job. On a single-box install there is exactly one, `local`. */
export interface DeployStep {
  box: string;
  state: 'pending' | 'running' | 'succeeded' | 'failed' | 'halted-destructive';
  exitCode: number | null;
  reason: string | null;
}

/** A cross-box upgrade that got partway is not the same as one that failed at the start. */
export interface DeployPartial {
  completed: string[];
  incomplete: string[];
}

export interface DeployJob {
  id: string;
  action: string;
  service: string | null;
  tag: string | null;
  state: 'running' | 'succeeded' | 'failed' | 'halted-destructive';
  exitCode: number | null;
  startedAt: string;
  endedAt: string | null;
  needsApproval: DeployApproval | null;
  reason: string | null;
  partial: DeployPartial | null;
  steps: DeployStep[];
  logSize: number;
}

export interface DeployState {
  agentAvailable: boolean;
  agentVersion: string | null;
  tiers: DeployTier[];
  runningJob: DeployJob | null;
}

/** `unknown` is not `current` — an unreachable registry must never read as up to date. */
export interface DeployAvailability {
  status: 'current' | 'behind' | 'unknown';
  newestRelease: string | null;
  message: string | null;
}
