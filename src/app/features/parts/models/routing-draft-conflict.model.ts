export interface RoutingDraftConflict {
  operationId: number;
  stepNumber: number;
  predecessorId: number;
  predecessorStepNumber: number | null;
}
