import { describe, it, expect } from 'vitest';

import { RoutingDraftStep } from '../models/routing-draft-step.model';
import {
  connectSteps, disconnectSteps, draftConflicts, draftRequest, draftSignature, moveStep, removeConflicts,
  reorderSteps, runAfterPrevious, runAlongside, setLinkGate,
} from './routing-graph-draft.utils';
import { effectivePredecessors } from './routing-predecessors.utils';
import { nodeAt, routingGraphLayout } from './routing-graph-layout.utils';

function step(id: number, stepNumber: number, ...follows: number[]): RoutingDraftStep {
  return {
    id, stepNumber, title: `Step ${stepNumber}`, workCenterName: null,
    predecessors: follows.map(operationId => ({ operationId, stepNumber: 0, gate: 'Quantity' as const })),
  };
}

const LINE: RoutingDraftStep[] = [step(1, 10), step(2, 20), step(3, 30), step(4, 40)];

function follows(draft: RoutingDraftStep[], id: number): number[] {
  return (effectivePredecessors(draft).get(id) ?? []).map(link => link.predecessorId).sort();
}

describe('routing graph draft — connect and disconnect', () => {
  it('connecting keeps the links a step already showed and adds the new one', () => {
    const { draft, error } = connectSteps(LINE, 1, 4);

    expect(error).toBeNull();
    expect(follows(draft, 4)).toEqual([1, 3]);
    expect(draft.find(s => s.id === 4)!.predecessors.map(l => l.operationId)).toEqual([3, 1]);
  });

  it('refuses a link that points at a later step, at itself, or that already exists', () => {
    expect(connectSteps(LINE, 3, 2).error).toBe('order');
    expect(connectSteps(LINE, 2, 2).error).toBe('self');
    expect(connectSteps(LINE, 2, 3).error).toBe('exists');
  });

  it('removing the last explicit link goes back to following the previous step', () => {
    const parallel = connectSteps(LINE, 1, 3).draft;
    const alone = disconnectSteps(parallel, 3, 2).draft;

    expect(follows(alone, 3)).toEqual([1]);
    expect(follows(disconnectSteps(alone, 3, 1).draft, 3)).toEqual([2]);
  });

  it('a step that only follows the previous step by default cannot be left with nothing', () => {
    expect(disconnectSteps(LINE, 3, 2).error).toBe('onlyPrevious');
  });

  it('turns a link into a wait-for-done link without changing the shape', () => {
    const { draft } = setLinkGate(LINE, 3, 2, 'Complete');

    expect(draft.find(s => s.id === 3)!.predecessors).toEqual([{ operationId: 2, stepNumber: 20, gate: 'Complete' }]);
    expect(follows(draft, 3)).toEqual([2]);
  });
});

describe('routing graph draft — lanes', () => {
  it('runs a step alongside another by following the same steps, and the next step waits for both', () => {
    const { draft, error } = runAlongside(LINE, 3, 2);

    expect(error).toBeNull();
    expect(follows(draft, 3)).toEqual([1]);
    expect(follows(draft, 4)).toEqual([2, 3]);
  });

  it('the later of the two steps joins the earlier one\'s lane whichever is dragged', () => {
    expect(runAlongside(LINE, 2, 3).draft).toEqual(runAlongside(LINE, 3, 2).draft);
  });

  it('cannot run alongside the first step, or alongside a step with the same number', () => {
    expect(runAlongside(LINE, 2, 1).error).toBe('firstStep');
    expect(runAlongside([step(1, 10), step(2, 20), step(3, 20)], 2, 3).error).toBe('order');
  });

  it('run after the previous step clears the explicit links', () => {
    const parallel = runAlongside(LINE, 3, 2).draft;

    expect(runAfterPrevious(parallel, 3).draft.find(s => s.id === 3)!.predecessors).toEqual([]);
  });

  it('lays parallel steps out in one column, in separate lanes, and a join in the next column', () => {
    const diamond = [step(1, 10), step(2, 20, 1), step(3, 30, 1), step(4, 40, 2, 3)];
    const layout = routingGraphLayout(diamond);
    const at = new Map(layout.nodes.map(n => [n.step.id, n]));

    expect([at.get(2)!.column, at.get(3)!.column]).toEqual([1, 1]);
    expect([at.get(2)!.lane, at.get(3)!.lane]).toEqual([0, 1]);
    expect(at.get(4)!.column).toBe(2);
    expect(layout.edges.map(e => `${e.fromStep}>${e.toStep}`)).toEqual(['10>20', '10>30', '20>40', '30>40']);
    expect(nodeAt(layout, at.get(3)!.x + 5, at.get(3)!.y + 5)!.step.id).toBe(3);
    expect(nodeAt(layout, 0, 0)).toBeNull();
  });

  it('routes a link that skips a column below the steps it passes', () => {
    const layout = routingGraphLayout([step(1, 10), step(2, 20), step(3, 30, 1, 2)]);
    const skip = layout.edges.find(e => e.fromStep === 10 && e.toStep === 30)!;
    const next = layout.edges.find(e => e.fromStep === 20 && e.toStep === 30)!;

    expect(skip.path).toContain(' L ');
    expect(next.path).not.toContain(' L ');
  });

  it('draws the default link to the previous step as implicit', () => {
    const layout = routingGraphLayout(LINE);

    expect(layout.edges.every(e => e.implicit)).toBe(true);
    expect(layout.width).toBeGreaterThan(layout.height);
  });
});

describe('routing graph draft — order', () => {
  it('moving a step keeps the routing step numbers and swaps their owners', () => {
    const moved = moveStep(LINE, 3, -1);

    expect(moved.map(s => [s.id, s.stepNumber])).toEqual([[1, 10], [3, 20], [2, 30], [4, 40]]);
  });

  it('renumbers by tens when the old numbers are shared', () => {
    const shared = [step(1, 10), step(2, 20), step(3, 20)];

    expect(reorderSteps(shared, [3, 1, 2]).map(s => [s.id, s.stepNumber])).toEqual([[3, 10], [1, 20], [2, 30]]);
  });

  it('a move that breaks a link is reported live and can be cleared', () => {
    const linked = connectSteps(LINE, 1, 3).draft;
    const moved = moveStep(linked, 1, 3);
    const conflicts = draftConflicts(moved);

    expect(conflicts.map(c => [c.stepNumber, c.predecessorStepNumber])).toEqual([[20, 40]]);
    expect(draftConflicts(removeConflicts(moved, conflicts))).toEqual([]);
    expect(routingGraphLayout(moved).edges.some(e => e.conflict)).toBe(true);
  });
});

describe('routing graph draft — request and dirtiness', () => {
  it('sends every step with its own explicit links only', () => {
    const request = draftRequest(runAlongside(LINE, 3, 2).draft);

    expect(request).toEqual([
      { operationId: 1, stepNumber: 10, predecessors: [] },
      { operationId: 2, stepNumber: 20, predecessors: [] },
      { operationId: 3, stepNumber: 30, predecessors: [{ operationId: 1, gate: 'Quantity' }] },
      { operationId: 4, stepNumber: 40, predecessors: [{ operationId: 3, gate: 'Quantity' }, { operationId: 2, gate: 'Quantity' }] },
    ]);
  });

  it('the signature ignores link order and display numbers but sees gates', () => {
    const a = [step(1, 10), step(2, 20), step(3, 30, 1, 2)];
    const b = [step(3, 30, 2, 1), step(2, 20), step(1, 10)];

    expect(draftSignature(a)).toBe(draftSignature(b));
    expect(draftSignature(setLinkGate(a, 3, 1, 'Complete').draft)).not.toBe(draftSignature(a));
  });
});
