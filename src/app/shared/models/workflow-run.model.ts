/**
 * Workflow Pattern Phase 4 — Mirror of `WorkflowRunResponseModel` (server).
 * Per D6, step completion is derived from entity data (predicate evaluation),
 * not stored on the run row. The run only carries UX metadata: which
 * definition is pinned, the current step pointer, mode, lifecycle timestamps.
 */
export interface WorkflowRun {
  id: number;
  entityType: string;
  entityId: number;
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
