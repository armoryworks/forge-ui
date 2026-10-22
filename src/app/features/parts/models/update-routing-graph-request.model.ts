import { RoutingGraphStepRequest } from './routing-graph-step-request.model';

export interface UpdateRoutingGraphRequest {
  version: string | null;
  steps: RoutingGraphStepRequest[];
}
