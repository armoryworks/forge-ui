import { RoutingGraphEdgeLayout } from './routing-graph-edge-layout.model';
import { RoutingGraphNodeLayout } from './routing-graph-node-layout.model';

export interface RoutingGraphLayout {
  nodes: RoutingGraphNodeLayout[];
  edges: RoutingGraphEdgeLayout[];
  width: number;
  height: number;
}
