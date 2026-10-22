import { PredecessorGate } from '../../../shared/models/predecessor-gate.type';

export interface RoutingGraphEdgeLayout {
  key: string;
  fromId: number;
  toId: number;
  fromStep: number;
  toStep: number;
  gate: PredecessorGate;
  implicit: boolean;
  conflict: boolean;
  path: string;
}
