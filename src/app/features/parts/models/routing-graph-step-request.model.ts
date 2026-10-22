import { OperationPredecessorRequest } from './operation-predecessor-request.model';

export interface RoutingGraphStepRequest {
  operationId: number;
  stepNumber: number;
  predecessors: OperationPredecessorRequest[];
}
