import { describe, expect, it } from 'vitest';

import { WorkflowRun } from '../../shared/models/workflow-run.model';
import { buildDraftPartRows } from './draft-part-rows.util';

function run(id: number, typed: Record<string, unknown> | null, picks: Record<string, unknown> = {}): WorkflowRun {
  return {
    id,
    entityType: 'Part',
    entityId: null,
    definitionId: 'part-buy-component-v1',
    currentStepId: 'basics',
    mode: 'guided',
    startedAt: '2026-10-01T12:00:00Z',
    startedByUserId: 1,
    completedAt: null,
    abandonedAt: null,
    abandonedReason: null,
    lastActivityAt: '2026-10-01T12:05:00Z',
    version: 1,
    draftPayload: typed ? { ...picks, typed } : (Object.keys(picks).length ? picks : null),
  };
}

describe('buildDraftPartRows', () => {
  it('labels a draft with the typed part number and name', () => {
    const [row] = buildDraftPartRows([run(7, { partNumber: 'BRK-100', name: 'Mounting bracket' })], '', 'Unnamed draft');

    expect(row.id).toBe(-7);
    expect(row.partNumber).toBe('BRK-100');
    expect(row.name).toBe('Mounting bracket');
    expect(row._draftRun?.id).toBe(7);
  });

  it('uses the unnamed label only when both part number and name are empty', () => {
    const rows = buildDraftPartRows([
      run(1, { partNumber: '  ', name: '' }),
      run(2, null),
      run(3, { partNumber: 'BRK-100' }),
      run(4, { name: 'Mounting bracket' }),
    ], '', 'Unnamed draft');

    expect(rows.map(r => r.name)).toEqual(['Unnamed draft', 'Unnamed draft', '', 'Mounting bracket']);
    expect(rows.map(r => r.partNumber)).toEqual(['', '', 'BRK-100', '']);
  });

  it('keeps every draft when no search is active', () => {
    const rows = buildDraftPartRows([run(1, { name: 'Bracket' }), run(2, null)], '   ', 'Unnamed draft');

    expect(rows).toHaveLength(2);
  });

  it('keeps only drafts whose typed text matches the search, case-insensitively', () => {
    const rows = buildDraftPartRows([
      run(1, { partNumber: 'BRK-100', name: 'Mounting bracket' }),
      run(2, { partNumber: 'SCR-8', name: 'Machine screw' }),
      run(3, { name: 'Spacer', description: 'Bracket spacer, nylon' }),
      run(4, null),
    ], 'bracket', 'Unnamed draft');

    expect(rows.map(r => r.id)).toEqual([-1, -3]);
  });

  it('matches the search against the typed part number', () => {
    const rows = buildDraftPartRows([
      run(1, { partNumber: 'BRK-100' }),
      run(2, { partNumber: 'SCR-8' }),
    ], 'scr', 'Unnamed draft');

    expect(rows.map(r => r.partNumber)).toEqual(['SCR-8']);
  });

  it('ignores top-level fork payload keys when labelling', () => {
    const [row] = buildDraftPartRows([run(1, null, { name: 'Fork value', partNumber: 'FORK-1' })], '', 'Unnamed draft');

    expect([row.partNumber, row.name]).toEqual(['', 'Unnamed draft']);
  });

  it('drops a draft with nothing typed from any active search', () => {
    expect(buildDraftPartRows([run(1, null)], 'unnamed', 'Unnamed draft')).toEqual([]);
  });

  it('reads a fork-dialog-only payload as an unnamed draft that drops out of searches', () => {
    const forkOnly = run(1, null, { procurementSource: 'Make', inventoryClass: 'Subassembly', itemKindId: 3 });

    expect(buildDraftPartRows([forkOnly], '', 'Unnamed draft').map(r => r.name)).toEqual(['Unnamed draft']);
    expect(buildDraftPartRows([forkOnly], 'make', 'Unnamed draft')).toEqual([]);
  });

  it('reflects the picked procurement source and inventory class, with defaults', () => {
    const [picked, missing] = buildDraftPartRows([
      run(1, null, { procurementSource: 'Make', inventoryClass: 'Subassembly' }),
      run(2, null),
    ], '', 'Unnamed draft');

    expect([picked.procurementSource, picked.inventoryClass]).toEqual(['Make', 'Subassembly']);
    expect([missing.procurementSource, missing.inventoryClass]).toEqual(['Buy', 'Component']);
  });
});
