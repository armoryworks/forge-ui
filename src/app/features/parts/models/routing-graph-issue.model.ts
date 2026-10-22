export interface RoutingGraphIssue {
  kind: string;
  operationId: number;
  stepNumber: number | null;
  predecessorOperationId: number | null;
  predecessorStepNumber: number | null;
}
