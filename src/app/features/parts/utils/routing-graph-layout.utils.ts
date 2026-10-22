import { RoutingDraftStep } from '../models/routing-draft-step.model';
import { RoutingGraphEdgeLayout } from '../models/routing-graph-edge-layout.model';
import { RoutingGraphLayout } from '../models/routing-graph-layout.model';
import { RoutingGraphNodeLayout } from '../models/routing-graph-node-layout.model';
import { draftConflicts, sortDraft } from './routing-graph-draft.utils';
import { effectivePredecessors, routingDepths } from './routing-predecessors.utils';

export const ROUTING_NODE_WIDTH = 184;
export const ROUTING_NODE_HEIGHT = 88;
export const ROUTING_COLUMN_GAP = 64;
export const ROUTING_LANE_GAP = 24;
export const ROUTING_PADDING = 16;

export function routingGraphLayout(draft: readonly RoutingDraftStep[]): RoutingGraphLayout {
  const ordered = sortDraft(draft);
  const depths = routingDepths(ordered);
  const lanesUsed = new Map<number, number>();
  const nodes: RoutingGraphNodeLayout[] = ordered.map(step => {
    const column = depths.get(step.id) ?? 0;
    const lane = lanesUsed.get(column) ?? 0;
    lanesUsed.set(column, lane + 1);
    return {
      step,
      column,
      lane,
      x: ROUTING_PADDING + column * (ROUTING_NODE_WIDTH + ROUTING_COLUMN_GAP),
      y: ROUTING_PADDING + lane * (ROUTING_NODE_HEIGHT + ROUTING_LANE_GAP),
    };
  });
  const byId = new Map(nodes.map(node => [node.step.id, node]));

  const edges: RoutingGraphEdgeLayout[] = [];
  for (const [toId, links] of effectivePredecessors(ordered)) {
    const to = byId.get(toId)!;
    for (const link of links) {
      const from = byId.get(link.predecessorId);
      if (from === undefined) continue;
      edges.push(edge(from, to, link.gate, link.implicit, false));
    }
  }
  for (const conflict of draftConflicts(ordered)) {
    const from = byId.get(conflict.predecessorId);
    const to = byId.get(conflict.operationId);
    if (from === undefined || to === undefined) continue;
    const gate = to.step.predecessors.find(link => link.operationId === conflict.predecessorId)?.gate ?? 'Quantity';
    edges.push(edge(from, to, gate, false, true));
  }

  const columns = Math.max(0, ...nodes.map(node => node.column + 1));
  const lanes = Math.max(0, ...lanesUsed.values());
  return {
    nodes,
    edges: edges.sort((a, b) => a.toStep - b.toStep || a.fromStep - b.fromStep),
    width: ROUTING_PADDING * 2 + columns * ROUTING_NODE_WIDTH + Math.max(0, columns - 1) * ROUTING_COLUMN_GAP,
    height: ROUTING_PADDING * 2 + lanes * ROUTING_NODE_HEIGHT + lanes * ROUTING_LANE_GAP,
  };
}

export function nodeAt(layout: RoutingGraphLayout, x: number, y: number): RoutingGraphNodeLayout | null {
  return layout.nodes.find(node =>
    x >= node.x && x <= node.x + ROUTING_NODE_WIDTH && y >= node.y && y <= node.y + ROUTING_NODE_HEIGHT) ?? null;
}

export function connectorPath(x1: number, y1: number, x2: number, y2: number): string {
  const bend = Math.max(24, Math.abs(x2 - x1) / 2);
  return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
}

export function detourPath(x1: number, y1: number, x2: number, y2: number, below: number): string {
  const bend = ROUTING_COLUMN_GAP / 2;
  return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x1 + bend} ${below}, ${x1 + bend * 2} ${below} `
    + `L ${x2 - bend * 2} ${below} C ${x2 - bend} ${below}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
}

function edge(
  from: RoutingGraphNodeLayout, to: RoutingGraphNodeLayout, gate: RoutingGraphEdgeLayout['gate'], implicit: boolean, conflict: boolean,
): RoutingGraphEdgeLayout {
  const x1 = from.x + ROUTING_NODE_WIDTH;
  const y1 = from.y + ROUTING_NODE_HEIGHT / 2;
  const x2 = to.x;
  const y2 = to.y + ROUTING_NODE_HEIGHT / 2;
  return {
    key: `${from.step.id}>${to.step.id}${conflict ? '!' : ''}`,
    fromId: from.step.id,
    toId: to.step.id,
    fromStep: from.step.stepNumber,
    toStep: to.step.stepNumber,
    gate,
    implicit,
    conflict,
    path: to.column - from.column === 1
      ? connectorPath(x1, y1, x2, y2)
      : detourPath(x1, y1, x2, y2, Math.max(from.y, to.y) + ROUTING_NODE_HEIGHT + ROUTING_LANE_GAP / 2),
  };
}
