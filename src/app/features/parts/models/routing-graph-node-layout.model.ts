import { RoutingDraftStep } from './routing-draft-step.model';

export interface RoutingGraphNodeLayout {
  step: RoutingDraftStep;
  column: number;
  lane: number;
  x: number;
  y: number;
}
