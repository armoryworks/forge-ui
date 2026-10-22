import { RoutingDraftError } from './routing-draft-error.type';
import { RoutingDraftStep } from './routing-draft-step.model';

export interface RoutingDraftResult {
  draft: RoutingDraftStep[];
  error: RoutingDraftError | null;
}
