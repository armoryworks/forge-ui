import { OperationPredecessor } from './operation-predecessor.model';

export interface RoutingDraftStep {
  id: number;
  stepNumber: number;
  title: string;
  workCenterName: string | null;
  predecessors: OperationPredecessor[];
}
