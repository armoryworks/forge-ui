import { StepGatingMode } from './step-gating-mode.type';

export interface OperationGate {
  mode: StepGatingMode;
  available: number | null;
  availableFromStep: number | null;
  waitingOnSteps: number[];
  canOverride: boolean;
}
