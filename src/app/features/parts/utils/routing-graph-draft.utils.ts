import { Operation } from '../models/operation.model';
import { OperationPredecessor } from '../models/operation-predecessor.model';
import { RoutingDraftConflict } from '../models/routing-draft-conflict.model';
import { RoutingDraftResult } from '../models/routing-draft-result.model';
import { RoutingDraftStep } from '../models/routing-draft-step.model';
import { RoutingGraphStepRequest } from '../models/routing-graph-step-request.model';
import { PredecessorGate } from '../../../shared/models/predecessor-gate.type';
import { effectivePredecessors } from './routing-predecessors.utils';

export function draftFromOperations(operations: readonly Operation[]): RoutingDraftStep[] {
  return sortDraft(operations.map(op => ({
    id: op.id,
    stepNumber: op.stepNumber,
    title: op.title,
    workCenterName: op.workCenterName,
    predecessors: (op.predecessors ?? []).map(link => ({ ...link })),
  })));
}

export function sortDraft(draft: readonly RoutingDraftStep[]): RoutingDraftStep[] {
  return [...draft].sort((a, b) => a.stepNumber - b.stepNumber || a.id - b.id);
}

export function draftConflicts(draft: readonly RoutingDraftStep[]): RoutingDraftConflict[] {
  const byId = new Map(draft.map(step => [step.id, step]));
  const conflicts: RoutingDraftConflict[] = [];
  for (const step of sortDraft(draft)) {
    for (const link of step.predecessors) {
      const predecessor = byId.get(link.operationId);
      if (predecessor === undefined || predecessor.id === step.id || predecessor.stepNumber >= step.stepNumber) {
        conflicts.push({
          operationId: step.id,
          stepNumber: step.stepNumber,
          predecessorId: link.operationId,
          predecessorStepNumber: predecessor?.stepNumber ?? null,
        });
      }
    }
  }
  return conflicts;
}

export function connectSteps(draft: readonly RoutingDraftStep[], fromId: number, toId: number): RoutingDraftResult {
  const from = draft.find(step => step.id === fromId);
  const to = draft.find(step => step.id === toId);
  if (from === undefined || to === undefined) return { draft: [...draft], error: 'edge' };
  if (fromId === toId) return { draft: [...draft], error: 'self' };
  if (from.stepNumber >= to.stepNumber) return { draft: [...draft], error: 'order' };

  const current = visibleLinks(draft, to);
  if (current.some(link => link.operationId === fromId)) return { draft: [...draft], error: 'exists' };
  return withLinks(draft, toId, [...current, { operationId: fromId, stepNumber: from.stepNumber, gate: 'Quantity' }]);
}

export function disconnectSteps(draft: readonly RoutingDraftStep[], toId: number, fromId: number): RoutingDraftResult {
  const to = draft.find(step => step.id === toId);
  if (to === undefined) return { draft: [...draft], error: 'edge' };
  if (to.predecessors.some(link => link.operationId === fromId)) {
    return withLinks(draft, toId, to.predecessors.filter(link => link.operationId !== fromId));
  }
  const implicit = visibleLinks(draft, to);
  if (!implicit.some(link => link.operationId === fromId)) return { draft: [...draft], error: 'edge' };
  const remaining = implicit.filter(link => link.operationId !== fromId);
  if (remaining.length === 0) return { draft: [...draft], error: 'onlyPrevious' };
  return withLinks(draft, toId, remaining);
}

export function setLinkGate(
  draft: readonly RoutingDraftStep[], toId: number, fromId: number, gate: PredecessorGate,
): RoutingDraftResult {
  const to = draft.find(step => step.id === toId);
  if (to === undefined) return { draft: [...draft], error: 'edge' };
  const links = visibleLinks(draft, to);
  if (!links.some(link => link.operationId === fromId)) return { draft: [...draft], error: 'edge' };
  return withLinks(draft, toId, links.map(link => link.operationId === fromId ? { ...link, gate } : link));
}

export function runAlongside(draft: readonly RoutingDraftStep[], id: number, siblingId: number): RoutingDraftResult {
  const first = draft.find(s => s.id === id);
  const second = draft.find(s => s.id === siblingId);
  if (first === undefined || second === undefined || id === siblingId) return { draft: [...draft], error: 'edge' };
  if (first.stepNumber === second.stepNumber) return { draft: [...draft], error: 'order' };
  const [step, sibling] = first.stepNumber > second.stepNumber ? [first, second] : [second, first];

  const links = visibleLinks(draft, sibling);
  if (links.length === 0) return { draft: [...draft], error: 'firstStep' };
  if (links.some(link => link.operationId === step.id)) return { draft: [...draft], error: 'order' };

  const before = effectivePredecessors(draft);
  const joins = draft.filter(s => s.id !== sibling.id && s.stepNumber > sibling.stepNumber
    && (before.get(s.id) ?? []).some(link => link.predecessorId === step.id)
    && !(before.get(s.id) ?? []).some(link => link.predecessorId === sibling.id));

  let next = withLinks(draft, step.id, links.map(link => ({ ...link }))).draft;
  for (const join of joins) {
    const current = (before.get(join.id) ?? []).map(link => ({ operationId: link.predecessorId, stepNumber: link.stepNumber, gate: link.gate }));
    next = withLinks(next, join.id, [...current, { operationId: sibling.id, stepNumber: sibling.stepNumber, gate: 'Quantity' }]).draft;
  }
  return { draft: next, error: null };
}

export function runAfterPrevious(draft: readonly RoutingDraftStep[], id: number): RoutingDraftResult {
  if (!draft.some(step => step.id === id)) return { draft: [...draft], error: 'edge' };
  return withLinks(draft, id, []);
}

export function moveStep(draft: readonly RoutingDraftStep[], id: number, delta: number): RoutingDraftStep[] {
  const ordered = sortDraft(draft);
  const from = ordered.findIndex(step => step.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ordered.length) return ordered;
  const ids = ordered.map(step => step.id);
  ids.splice(to, 0, ...ids.splice(from, 1));
  return reorderSteps(draft, ids);
}

export function reorderSteps(draft: readonly RoutingDraftStep[], orderedIds: readonly number[]): RoutingDraftStep[] {
  const numbers = draft.map(step => step.stepNumber).sort((a, b) => a - b);
  const distinct = new Set(numbers).size === numbers.length && numbers.every(n => n > 0);
  const byId = new Map(draft.map(step => [step.id, step]));
  return orderedIds
    .map((id, index) => ({ step: byId.get(id), stepNumber: distinct ? numbers[index] : (index + 1) * 10 }))
    .filter((entry): entry is { step: RoutingDraftStep; stepNumber: number } => entry.step !== undefined)
    .map(({ step, stepNumber }) => ({ ...step, stepNumber, predecessors: renumberLinks(step.predecessors, byId, orderedIds, numbers, distinct) }));
}

export function removeConflicts(draft: readonly RoutingDraftStep[], conflicts: readonly RoutingDraftConflict[]): RoutingDraftStep[] {
  return draft.map(step => {
    const own = conflicts.filter(c => c.operationId === step.id);
    return own.length === 0
      ? step
      : { ...step, predecessors: step.predecessors.filter(link => !own.some(c => c.predecessorId === link.operationId)) };
  });
}

export function draftRequest(draft: readonly RoutingDraftStep[]): RoutingGraphStepRequest[] {
  return sortDraft(draft).map(step => ({
    operationId: step.id,
    stepNumber: step.stepNumber,
    predecessors: step.predecessors.map(link => ({ operationId: link.operationId, gate: link.gate })),
  }));
}

export function draftSignature(draft: readonly RoutingDraftStep[]): string {
  return sortDraft(draft)
    .map(step => `${step.id}:${step.stepNumber}[${[...step.predecessors]
      .sort((a, b) => a.operationId - b.operationId)
      .map(link => `${link.operationId}${link.gate === 'Complete' ? '!' : ''}`)
      .join(',')}]`)
    .join(';');
}

function visibleLinks(draft: readonly RoutingDraftStep[], step: RoutingDraftStep): OperationPredecessor[] {
  return (effectivePredecessors(draft).get(step.id) ?? [])
    .map(link => ({ operationId: link.predecessorId, stepNumber: link.stepNumber, gate: link.gate }));
}

function withLinks(draft: readonly RoutingDraftStep[], id: number, links: OperationPredecessor[]): RoutingDraftResult {
  return { draft: draft.map(step => step.id === id ? { ...step, predecessors: links } : step), error: null };
}

function renumberLinks(
  links: readonly OperationPredecessor[],
  byId: ReadonlyMap<number, RoutingDraftStep>,
  orderedIds: readonly number[],
  numbers: readonly number[],
  distinct: boolean,
): OperationPredecessor[] {
  return links.map(link => {
    const index = orderedIds.indexOf(link.operationId);
    if (index < 0 || !byId.has(link.operationId)) return { ...link };
    return { ...link, stepNumber: distinct ? numbers[index] : (index + 1) * 10 };
  });
}
