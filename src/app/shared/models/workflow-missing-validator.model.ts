/**
 * Workflow Pattern Phase 4 — Per-validator missing payload entry returned by
 * the server in 409 envelopes when a promote-status / workflow-complete /
 * step-jump request is rejected because readiness gates aren't satisfied.
 *
 * `blockingStepId` / `blockingStepLabelKey` are populated when the missing
 * validator can be tied to a specific step of the active workflow definition
 * (jump-ahead, complete, promote-with-run). They stay null when the missing
 * validator isn't bound to a step. Callers use these to render "Finish
 * 'Sourcing' first" instead of the generic "An earlier step is incomplete."
 */
export interface MissingValidator {
  validatorId: string;
  displayNameKey: string;
  missingMessageKey: string;
  blockingStepId?: string | null;
  blockingStepLabelKey?: string | null;
}
