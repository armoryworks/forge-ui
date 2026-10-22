import { HttpErrorResponse } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { describe, expect, it } from 'vitest';

import { describeStepGate, stepGateViolationOf } from './step-gate-error';
import { StepGateViolation } from '../models/step-gate-violation.model';

const violation: StepGateViolation = {
  mode: 'Warn', gate: 'Quantity', predecessorStep: 20, available: 8, requested: 12, waitingOnSteps: [], canOverride: true,
};
const translate = {
  instant: (key: string, params?: Record<string, unknown>) => `${key} ${JSON.stringify(params)}`,
} as unknown as TranslateService;

describe('stepGateViolationOf', () => {
  it('reads the gate from a step-gate 409', () => {
    const error = new HttpErrorResponse({ status: 409, error: { code: 'step-gate', gate: violation } });
    expect(stepGateViolationOf(error)).toEqual(violation);
  });

  it('ignores other conflicts and other statuses', () => {
    expect(stepGateViolationOf(new HttpErrorResponse({ status: 409, error: { code: 'predecessor-conflict', gate: violation } }))).toBeNull();
    expect(stepGateViolationOf(new HttpErrorResponse({ status: 400, error: { code: 'step-gate', gate: violation } }))).toBeNull();
    expect(stepGateViolationOf(new Error('step-gate'))).toBeNull();
  });
});

describe('describeStepGate', () => {
  it('says how many pieces are available from which step', () => {
    expect(describeStepGate(violation, translate)).toBe('jobOperations.gate.available {"available":8,"step":20}');
  });

  it('lists the steps a Done is waiting on', () => {
    expect(describeStepGate({ ...violation, gate: 'Complete', available: null, waitingOnSteps: [20, 30] }, translate))
      .toBe('jobOperations.gate.waitingOn {"steps":"20, 30"}');
  });
});
