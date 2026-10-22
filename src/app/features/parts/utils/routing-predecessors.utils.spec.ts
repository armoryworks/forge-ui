import { describe, it, expect } from 'vitest';

import { Operation } from '../models/operation.model';
import { defaultPredecessorIds, effectivePredecessors, routingDepths } from './routing-predecessors.utils';

function op(id: number, stepNumber: number, predecessors: Operation['predecessors'] = []): Operation {
  return {
    id, partId: 1, stepNumber, title: `Step ${stepNumber}`, instructions: null, workCenterId: null, workCenterName: null,
    estimatedMs: null, setupMinutes: 0, runMinutesLot: 0, scrapFactor: 0, isQcCheckpoint: false, qcCriteria: null,
    referencedOperationId: null, referencedOperationTitle: null, materials: [], createdAt: new Date(), updatedAt: new Date(),
    isSubcontract: false, subcontractVendorId: null, subcontractVendorName: null, subcontractTurnTimeDays: null, predecessors,
  };
}

describe('routing predecessors', () => {
  it('defaults a step to the previous step number', () => {
    const ops = [op(1, 10), op(2, 20), op(3, 20), op(4, 30)];

    expect(defaultPredecessorIds(ops, 30)).toEqual([2, 3]);
    expect(defaultPredecessorIds(ops, 10)).toEqual([]);
    expect(effectivePredecessors(ops).get(4)!.every(link => link.implicit)).toBe(true);
  });

  it('uses explicit links and ignores ones that point at a later step', () => {
    const ops = [op(1, 10), op(2, 20, [{ operationId: 1, stepNumber: 10, gate: 'Complete' }]), op(3, 30, [{ operationId: 4, stepNumber: 40, gate: 'Quantity' }]), op(4, 40)];
    const links = effectivePredecessors(ops);

    expect(links.get(2)).toEqual([{ predecessorId: 1, stepNumber: 10, gate: 'Complete', implicit: false }]);
    expect(links.get(3)).toEqual([{ predecessorId: 2, stepNumber: 20, gate: 'Quantity', implicit: true }]);
  });

  it('lays parallel steps out in the same column and a join after both', () => {
    const after10 = [{ operationId: 1, stepNumber: 10, gate: 'Quantity' as const }];
    const ops = [
      op(1, 10), op(2, 20, after10), op(3, 30, after10),
      op(4, 40, [{ operationId: 2, stepNumber: 20, gate: 'Quantity' }, { operationId: 3, stepNumber: 30, gate: 'Quantity' }]),
    ];

    expect([...routingDepths(ops).entries()]).toEqual([[1, 0], [2, 1], [3, 1], [4, 2]]);
  });
});
