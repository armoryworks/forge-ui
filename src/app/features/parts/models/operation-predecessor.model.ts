import { PredecessorGate } from '../../../shared/models/predecessor-gate.type';

export interface OperationPredecessor {
  operationId: number;
  stepNumber: number;
  gate: PredecessorGate;
}
