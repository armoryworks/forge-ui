import { PredecessorGate } from './predecessor-gate.type';
import { StepGatingMode } from './step-gating-mode.type';

export interface StepGateViolation {
  mode: StepGatingMode;
  gate: PredecessorGate;
  predecessorStep: number | null;
  available: number | null;
  requested: number;
  waitingOnSteps: number[];
  canOverride: boolean;
}
