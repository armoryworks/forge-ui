export interface PredecessorConflict {
  operationId: number;
  stepNumber: number;
  predecessorOperationId: number;
  predecessorStepNumber: number;
}
