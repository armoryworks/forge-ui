import { Operation } from '../models/operation.model';
import { RoutingLink } from '../models/routing-link.model';

export type RoutingNode = Pick<Operation, 'id' | 'stepNumber' | 'predecessors'>;

export function defaultPredecessorIds(operations: readonly RoutingNode[], stepNumber: number, excludeId?: number | null): number[] {
  const lower = operations.filter(op => op.id !== excludeId && op.stepNumber < stepNumber);
  if (lower.length === 0) return [];
  const previous = Math.max(...lower.map(op => op.stepNumber));
  return lower.filter(op => op.stepNumber === previous).map(op => op.id);
}

export function effectivePredecessors(operations: readonly RoutingNode[]): Map<number, RoutingLink[]> {
  const byId = new Map(operations.map(op => [op.id, op]));
  const result = new Map<number, RoutingLink[]>();
  for (const op of operations) {
    const explicit = (op.predecessors ?? [])
      .filter(link => {
        const predecessor = byId.get(link.operationId);
        return predecessor !== undefined && predecessor.id !== op.id && predecessor.stepNumber < op.stepNumber;
      })
      .map(link => ({ predecessorId: link.operationId, stepNumber: byId.get(link.operationId)!.stepNumber, gate: link.gate, implicit: false }));
    result.set(op.id, explicit.length > 0
      ? explicit
      : defaultPredecessorIds(operations, op.stepNumber, op.id).map(id => ({
        predecessorId: id, stepNumber: byId.get(id)!.stepNumber, gate: 'Quantity' as const, implicit: true,
      })));
  }
  return result;
}

export function routingDepths(operations: readonly RoutingNode[]): Map<number, number> {
  const links = effectivePredecessors(operations);
  const depths = new Map<number, number>();
  const ordered = [...operations].sort((a, b) => a.stepNumber - b.stepNumber || a.id - b.id);
  for (const op of ordered) {
    const before = (links.get(op.id) ?? []).map(link => depths.get(link.predecessorId) ?? 0);
    depths.set(op.id, before.length === 0 ? 0 : Math.max(...before) + 1);
  }
  return depths;
}

export function deadEndStepIds(operations: readonly RoutingNode[]): Set<number> {
  if (operations.length === 0) return new Set();
  const followed = new Set<number>();
  for (const links of effectivePredecessors(operations).values()) {
    for (const link of links) followed.add(link.predecessorId);
  }
  const last = Math.max(...operations.map(op => op.stepNumber));
  return new Set(operations.filter(op => op.stepNumber < last && !followed.has(op.id)).map(op => op.id));
}
