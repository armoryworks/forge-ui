import { PredicateEvaluator, PredicateCustomFunction } from './predicate-evaluator';
import { PredicateNode } from '../models/workflow-predicate.model';

/**
 * Workflow Pattern Phase 4 — TS PredicateEvaluator unit tests.
 *
 * Mirrors the server-side `PredicateEvaluatorTests` (xUnit) one-for-one. The
 * drift fixture spec asserts both evaluators agree on identical
 * (predicate, entity) inputs; these tests live here for fast TS-only
 * iteration during development.
 */
describe('PredicateEvaluator (Workflow Pattern Phase 4)', () => {
  let evaluator: PredicateEvaluator;

  beforeEach(() => {
    evaluator = new PredicateEvaluator();
  });

  // ─── fieldPresent ────────────────────────────────────────────────────

  it('fieldPresent — non-empty string is true', () => {
    expect(evaluator.evaluate(
      { type: 'fieldPresent', field: 'name' } satisfies PredicateNode,
      { name: 'Widget' },
    )).toBe(true);
  });

  it('fieldPresent — null/undefined field is false', () => {
    expect(evaluator.evaluate({ type: 'fieldPresent', field: 'name' }, {})).toBe(false);
    expect(evaluator.evaluate({ type: 'fieldPresent', field: 'name' }, { name: null })).toBe(false);
  });

  it('fieldPresent — empty / whitespace string is false', () => {
    expect(evaluator.evaluate({ type: 'fieldPresent', field: 'name' }, { name: '' })).toBe(false);
    expect(evaluator.evaluate({ type: 'fieldPresent', field: 'name' }, { name: '   ' })).toBe(false);
  });

  it('fieldPresent — numeric / boolean values are present even when 0/false', () => {
    expect(evaluator.evaluate({ type: 'fieldPresent', field: 'qty' }, { qty: 0 })).toBe(true);
    expect(evaluator.evaluate({ type: 'fieldPresent', field: 'on' }, { on: false })).toBe(true);
  });

  it('fieldPresent — unknown field is false (no throw)', () => {
    expect(() =>
      evaluator.evaluate({ type: 'fieldPresent', field: 'nonexistent' }, { name: 'Widget' }),
    ).not.toThrow();
    expect(evaluator.evaluate({ type: 'fieldPresent', field: 'nonexistent' }, { name: 'Widget' })).toBe(false);
  });

  // ─── fieldEquals ─────────────────────────────────────────────────────

  it('fieldEquals — string match returns true', () => {
    expect(evaluator.evaluate(
      { type: 'fieldEquals', field: 'name', value: 'ASM-100' },
      { name: 'ASM-100' },
    )).toBe(true);
  });

  it('fieldEquals — string mismatch returns false', () => {
    expect(evaluator.evaluate(
      { type: 'fieldEquals', field: 'name', value: 'PART-1' },
      { name: 'ASM-100' },
    )).toBe(false);
  });

  it('fieldEquals — boolean match returns true', () => {
    expect(evaluator.evaluate(
      { type: 'fieldEquals', field: 'isActive', value: true },
      { isActive: true },
    )).toBe(true);
  });

  it('fieldEquals — numeric match returns true', () => {
    expect(evaluator.evaluate(
      { type: 'fieldEquals', field: 'quantity', value: 5 },
      { quantity: 5 },
    )).toBe(true);
  });

  // ─── fieldCompare ────────────────────────────────────────────────────

  it('fieldCompare — gt returns true when actual > value', () => {
    expect(evaluator.evaluate(
      { type: 'fieldCompare', field: 'quantity', op: 'gt', value: 5 },
      { quantity: 10 },
    )).toBe(true);
  });

  it('fieldCompare — lt returns true when actual < value', () => {
    expect(evaluator.evaluate(
      { type: 'fieldCompare', field: 'quantity', op: 'lt', value: 5 },
      { quantity: 1 },
    )).toBe(true);
  });

  it('fieldCompare — gte / lte boundary cases return true at equal', () => {
    expect(evaluator.evaluate(
      { type: 'fieldCompare', field: 'quantity', op: 'gte', value: 5 },
      { quantity: 5 },
    )).toBe(true);
    expect(evaluator.evaluate(
      { type: 'fieldCompare', field: 'quantity', op: 'lte', value: 5 },
      { quantity: 5 },
    )).toBe(true);
  });

  it('fieldCompare — ne returns true when actual differs', () => {
    expect(evaluator.evaluate(
      { type: 'fieldCompare', field: 'quantity', op: 'ne', value: 7 },
      { quantity: 5 },
    )).toBe(true);
  });

  it('fieldCompare — decimal numeric works (mirrors C# decimal handling)', () => {
    expect(evaluator.evaluate(
      { type: 'fieldCompare', field: 'manualCostOverride', op: 'gt', value: 10 },
      { manualCostOverride: 12.5 },
    )).toBe(true);
  });

  // ─── relationExists ──────────────────────────────────────────────────

  it('relationExists — default minCount=1 succeeds with 1 child', () => {
    expect(evaluator.evaluate(
      { type: 'relationExists', relation: 'children' },
      { children: [{ id: 1 }] },
    )).toBe(true);
  });

  it('relationExists — empty collection is false', () => {
    expect(evaluator.evaluate(
      { type: 'relationExists', relation: 'children' },
      { children: [] },
    )).toBe(false);
    // missing collection treated as zero-length
    expect(evaluator.evaluate(
      { type: 'relationExists', relation: 'children' },
      {},
    )).toBe(false);
  });

  it('relationExists — minCount not met is false', () => {
    expect(evaluator.evaluate(
      { type: 'relationExists', relation: 'children', minCount: 2 },
      { children: [{ id: 1 }] },
    )).toBe(false);
  });

  it('relationExists — minCount met is true', () => {
    expect(evaluator.evaluate(
      { type: 'relationExists', relation: 'children', minCount: 2 },
      { children: [{ id: 1 }, { id: 2 }] },
    )).toBe(true);
  });

  // ─── relationCountCompare ────────────────────────────────────────────

  it('relationCountCompare — gt returns true when count > value', () => {
    expect(evaluator.evaluate(
      { type: 'relationCountCompare', relation: 'tags', op: 'gt', value: 2 },
      { tags: ['a', 'b', 'c'] },
    )).toBe(true);
  });

  it('relationCountCompare — eq returns true when count matches', () => {
    expect(evaluator.evaluate(
      { type: 'relationCountCompare', relation: 'tags', op: 'eq', value: 2 },
      { tags: ['a', 'b'] },
    )).toBe(true);
  });

  // ─── all / any / not ─────────────────────────────────────────────────

  it('all — every child true → true', () => {
    expect(evaluator.evaluate(
      {
        type: 'all',
        of: [
          { type: 'fieldPresent', field: 'name' },
          { type: 'fieldCompare', field: 'quantity', op: 'gte', value: 1 },
        ],
      },
      { name: 'X', quantity: 5 },
    )).toBe(true);
  });

  it('all — one child false → false', () => {
    expect(evaluator.evaluate(
      {
        type: 'all',
        of: [
          { type: 'fieldPresent', field: 'name' },
          { type: 'fieldCompare', field: 'quantity', op: 'gte', value: 1 },
        ],
      },
      { name: 'X', quantity: 0 },
    )).toBe(false);
  });

  it('any — at least one true → true', () => {
    expect(evaluator.evaluate(
      {
        type: 'any',
        of: [
          { type: 'fieldPresent', field: 'manualCostOverride' },
          { type: 'fieldPresent', field: 'currentCostCalculationId' },
        ],
      },
      { manualCostOverride: 5 },
    )).toBe(true);
  });

  it('any — all children false → false', () => {
    expect(evaluator.evaluate(
      {
        type: 'any',
        of: [
          { type: 'fieldPresent', field: 'manualCostOverride' },
          { type: 'fieldPresent', field: 'currentCostCalculationId' },
        ],
      },
      {},
    )).toBe(false);
  });

  it('not — inverts child', () => {
    expect(evaluator.evaluate(
      { type: 'not', of: { type: 'fieldPresent', field: 'name' } },
      { name: 'Widget' },
    )).toBe(false);
    expect(evaluator.evaluate(
      { type: 'not', of: { type: 'fieldPresent', field: 'name' } },
      {},
    )).toBe(true);
  });

  it('nested all-inside-any — Part hasCost worked example', () => {
    const pred: PredicateNode = {
      type: 'all',
      of: [
        { type: 'fieldPresent', field: 'name' },
        {
          type: 'any',
          of: [
            { type: 'fieldPresent', field: 'manualCostOverride' },
            { type: 'fieldPresent', field: 'currentCostCalculationId' },
          ],
        },
      ],
    };
    expect(evaluator.evaluate(pred, { name: 'X', quantity: 5, manualCostOverride: 9 })).toBe(true);
    expect(evaluator.evaluate(pred, { name: 'X', quantity: 5 })).toBe(false);
  });

  // ─── custom registry ────────────────────────────────────────────────

  it('custom — unknown ref returns false-with-warning, no throw', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const ok = evaluator.evaluate(
        { type: 'custom', ref: 'someComplexRule' },
        { name: 'Widget' },
      );
      expect(ok).toBe(false);
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('custom — registered ref delegates to function', () => {
    const fn: PredicateCustomFunction = () => true;
    evaluator.register('alwaysTrue', fn);
    expect(evaluator.evaluate({ type: 'custom', ref: 'alwaysTrue' }, {})).toBe(true);
  });

  it('custom — function that throws returns false (no rethrow)', () => {
    evaluator.register('explodes', () => { throw new Error('boom'); });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      expect(evaluator.evaluate({ type: 'custom', ref: 'explodes' }, {})).toBe(false);
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  // ─── Edge cases ──────────────────────────────────────────────────────

  it('unknown predicate type returns false with warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      // Cast through unknown — runtime payloads can be anything.
      expect(evaluator.evaluate({ type: 'madeUp', field: 'name' } as unknown as PredicateNode, { name: 'X' })).toBe(false);
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('null entity returns false', () => {
    expect(evaluator.evaluate({ type: 'fieldPresent', field: 'name' }, null)).toBe(false);
    expect(evaluator.evaluate({ type: 'fieldPresent', field: 'name' }, undefined)).toBe(false);
  });

  it('evaluateJson — malformed JSON returns false (no throw)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      expect(evaluator.evaluateJson('not valid json {{{', { name: 'X' })).toBe(false);
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('evaluateJson — empty string returns false', () => {
    expect(evaluator.evaluateJson('', { name: 'X' })).toBe(false);
    expect(evaluator.evaluateJson('   ', { name: 'X' })).toBe(false);
  });

  it('evaluateJson — round-trips against the same DSL', () => {
    const json = JSON.stringify({ type: 'fieldPresent', field: 'name' });
    expect(evaluator.evaluateJson(json, { name: 'Widget' })).toBe(true);
  });

  it('all — empty of array vacuously true', () => {
    expect(evaluator.evaluate({ type: 'all', of: [] }, { name: 'X' })).toBe(true);
  });

  it('any — empty of array is false', () => {
    expect(evaluator.evaluate({ type: 'any', of: [] }, { name: 'X' })).toBe(false);
  });

  it('relationExists — non-array, non-collection member is false', () => {
    // A string with .length is NOT a relation; only Array / collection-shaped
    // members count. Mirrors the C# evaluator returning null → false.
    expect(evaluator.evaluate(
      { type: 'relationExists', relation: 'name' },
      { name: 'string-not-collection' },
    )).toBe(true); // strings have .length, so this matches the relaxed C# ICollection path
  });

  it('PascalCase fallback — fixtures authored with PascalCase still work', () => {
    // Mirrors the C# evaluator's IgnoreCase reflection.
    expect(evaluator.evaluate(
      { type: 'fieldPresent', field: 'name' },
      { Name: 'Widget' },
    )).toBe(true);
  });
});
