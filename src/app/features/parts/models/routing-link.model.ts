import { PredecessorGate } from '../../../shared/models/predecessor-gate.type';

export interface RoutingLink {
  predecessorId: number;
  stepNumber: number;
  gate: PredecessorGate;
  implicit: boolean;
}
