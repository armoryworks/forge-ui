import { Operation } from '../models/operation.model';
import { RoutingLink } from '../models/routing-link.model';

export function defaultPredecessorIds(operations: Operation[], stepNumber: number, excludeId?: number | null): number[] {
  const lower = operations.filter(op => op.id !== excludeId && op.stepNumber < stepNumber);
  if (lower.length === 0) return [];
  const previous = Math.max(...lower.map(op => op.stepNumber));
  return lower.filter(op => op.stepNumber === previous).map(op => op.id);
}

export function effectivePredecessors(operations: Operation[]): Map<number, RoutingLink[]> {
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

export function routingDepths(operations: Operation[]): Map<number, number> {
  const links = effectivePredecessors(operations);
  const depths = new Map<number, number>();
  const ordered = [...operations].sort((a, b) => a.stepNumber - b.stepNumber || a.id - b.id);
  for (const op of ordered) {
    const before = (links.get(op.id) ?? []).map(link => depths.get(link.predecessorId) ?? 0);
    depths.set(op.id, before.length === 0 ? 0 : Math.max(...before) + 1);
  }
  return depths;
}
