import { PredecessorGate } from '../../../shared/models/predecessor-gate.type';

export interface OperationPredecessorRequest {
  operationId: number;
  gate: PredecessorGate;
}
