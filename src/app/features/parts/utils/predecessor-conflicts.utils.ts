import { HttpErrorResponse } from '@angular/common/http';

import { PredecessorConflict } from '../models/predecessor-conflict.model';

export const PREDECESSOR_CONFLICT_CODE = 'predecessor-conflict';

export function predecessorConflictsOf(error: unknown): PredecessorConflict[] | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 409) return null;
  const body = error.error as { code?: string; conflicts?: PredecessorConflict[] } | null;
  return body?.code === PREDECESSOR_CONFLICT_CODE && Array.isArray(body.conflicts) ? body.conflicts : null;
}

export function describeConflicts(conflicts: PredecessorConflict[]): string {
  return conflicts.map(c => `Op ${c.stepNumber} → Op ${c.predecessorStepNumber}`).join(', ');
}
