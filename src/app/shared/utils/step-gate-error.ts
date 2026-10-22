import { HttpErrorResponse } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';

import { StepGateViolation } from '../models/step-gate-violation.model';

export const STEP_GATE_CODE = 'step-gate';

/** The step-gate details of a 409 the server raised because step gating stopped a progress update, or null. */
export function stepGateViolationOf(error: unknown): StepGateViolation | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 409) return null;
  const body = error.error as { code?: string; gate?: StepGateViolation } | null;
  return body?.code === STEP_GATE_CODE && body.gate && typeof body.gate === 'object' ? body.gate : null;
}

/** A translated sentence saying what the step is waiting for. */
export function describeStepGate(violation: StepGateViolation, translate: TranslateService): string {
  if (violation.gate === 'Complete') {
    return translate.instant('jobOperations.gate.waitingOn', { steps: (violation.waitingOnSteps ?? []).join(', ') });
  }
  return translate.instant('jobOperations.gate.available', {
    available: violation.available ?? 0,
    step: violation.predecessorStep ?? '',
  });
}
