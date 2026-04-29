/**
 * Workflow Pattern Phase 4 — Per-validator missing payload entry returned by
 * the server in 409 envelopes when a promote-status / workflow-complete
 * request is rejected because readiness gates aren't satisfied.
 */
export interface MissingValidator {
  validatorId: string;
  displayNameKey: string;
  missingMessageKey: string;
}
