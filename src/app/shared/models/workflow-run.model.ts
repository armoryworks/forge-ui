/**
 * Workflow Pattern Phase 4 — Mirror of `WorkflowRunResponseModel` (server).
 * Per D6, step completion is derived from entity data (predicate evaluation),
 * not stored on the run row. The run only carries UX metadata: which
 * definition is pinned, the current step pointer, mode, lifecycle timestamps.
 *
 * `entityId` is nullable — the entity row materializes when the workflow's
 * first step submits valid data (deferred materialization). UI shells must
 * tolerate the null state and only surface entity-bound steps once an id
 * has been stamped.
 */
export interface WorkflowRun {
  id: number;
  entityType: string;
  entityId: number | null;
  definitionId: string;
  currentStepId: string | null;
  mode: 'express' | 'guided';
  startedAt: string;
  startedByUserId: number;
  completedAt: string | null;
  abandonedAt: string | null;
  abandonedReason: string | null;
  lastActivityAt: string;
  version: number;
}
