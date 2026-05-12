import fixtures from './__fixtures__/predicate-drift-fixtures.json';

import { PredicateEvaluator } from './predicate-evaluator';

/**
 * Workflow Pattern Phase 4 — predicate evaluator drift test (TS side).
 *
 * Loads the shared fixture file and asserts the TS evaluator produces the
 * expected boolean for every case. The C# side runs the same assertions
 * (`PredicateDriftFixtureTests` in forge.tests/Workflows). If both
 * specs pass, the two evaluators are in lock-step on the documented inputs
 * — no behavioral drift between tiers.
 *
 * Adding a fixture case is a contract change: it MUST run green in BOTH
 * test suites before landing.
 */

interface DriftFixtureCase {
  name: string;
  predicate: unknown;
  entity: unknown;
  expected: boolean;
}

interface DriftFixtureFile {
  cases: DriftFixtureCase[];
}

describe('PredicateEvaluator — drift fixture (TS twin of C#)', () => {
  const evaluator = new PredicateEvaluator();
  const file = fixtures as DriftFixtureFile;

  it('fixture file has at least 10 cases', () => {
    expect(file.cases.length).toBeGreaterThanOrEqual(10);
  });

  it.each(file.cases)('$name', (kase) => {
    // Suppress the expected console.warn for unknown_type / custom_unknown_ref
    // cases without losing real failures.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const actual = evaluator.evaluate(kase.predicate, kase.entity);
      expect(actual).toBe(kase.expected);
    } finally {
      warn.mockRestore();
    }
  });
});
