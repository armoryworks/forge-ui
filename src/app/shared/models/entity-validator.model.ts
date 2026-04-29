/**
 * Workflow Pattern Phase 4 — Mirror of `EntityValidatorResponseModel` (server).
 *
 * Entity readiness validators are stored as DATA in the DB. Each validator
 * carries a predicate (DSL JSON) the UI evaluates client-side via
 * `PredicateEvaluator`. Status promotion runs the same DSL on the server
 * tier so client and server agree on completeness — see drift test.
 */
export interface EntityValidator {
  id: number;
  entityType: string;
  validatorId: string;
  /** Raw predicate JSON string from the DB. Parse before evaluating. */
  predicate: string;
  displayNameKey: string;
  missingMessageKey: string;
  isSeedData: boolean;
}
