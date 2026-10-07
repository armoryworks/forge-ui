import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { QcInspection } from '../../../quality/models/qc-inspection.model';
import { QualityService } from '../../../quality/services/quality.service';
import { ScanInspectFlowComponent } from './scan-inspect-flow.component';

const TEMPLATE_INSPECTION: QcInspection = {
  id: 11,
  jobId: null,
  jobNumber: null,
  productionRunId: null,
  templateId: 4,
  templateName: 'Final',
  inspectorId: 7,
  inspectorName: 'Pat Inspector',
  lotNumber: null,
  status: 'InProgress',
  notes: null,
  completedAt: null,
  results: [
    { id: 101, checklistItemId: 1, description: 'Visual', passed: false, measuredValue: null, notes: null },
    { id: 102, checklistItemId: 2, description: 'Fit', passed: false, measuredValue: '2.5', notes: null },
  ],
  createdAt: new Date('2026-09-01'),
};

interface FlowInternals {
  setResult: (value: 'Pass' | 'Fail') => void;
  submitInspection: () => void;
  step: () => string;
  error: () => string | null;
}

function setup(updateResponses: unknown[]) {
  const createInspection = vi.fn(() => of(TEMPLATE_INSPECTION));
  const updateInspection = vi.fn(() => updateResponses.shift() as ReturnType<QualityService['updateInspection']>);
  TestBed.configureTestingModule({
    providers: [{ provide: QualityService, useValue: { createInspection, updateInspection } }],
  });
  const component = TestBed.runInInjectionContext(() => new ScanInspectFlowComponent());
  mockSignalInputs(component, { partId: 5, partNumber: 'P-5', qcTemplateId: 4 });
  return { flow: component as unknown as FlowInternals, createInspection, updateInspection };
}

describe('ScanInspectFlowComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.useFakeTimers();
  });

  afterEach(() => vi.useRealTimers());

  it('passes a template inspection by attesting every pre-filled checklist result', () => {
    const { flow, updateInspection } = setup([of(TEMPLATE_INSPECTION)]);

    flow.setResult('Pass');
    flow.submitInspection();

    expect(updateInspection).toHaveBeenCalledWith(11, {
      status: 'Passed',
      notes: undefined,
      results: [
        { id: 101, checklistItemId: 1, description: 'Visual', passed: true, measuredValue: undefined, notes: undefined },
        { id: 102, checklistItemId: 2, description: 'Fit', passed: true, measuredValue: '2.5', notes: undefined },
      ],
    });
    expect(flow.step()).toBe('done');
  });

  it('fails an inspection with the status alone', () => {
    const { flow, updateInspection } = setup([of(TEMPLATE_INSPECTION)]);

    flow.setResult('Fail');
    flow.submitInspection();

    expect(updateInspection).toHaveBeenCalledWith(11, { status: 'Failed', notes: undefined, results: undefined });
  });

  it('retries a refused completion on the same inspection instead of creating another', () => {
    const { flow, createInspection, updateInspection } = setup([
      throwError(() => ({ status: 409 })),
      of(TEMPLATE_INSPECTION),
    ]);

    flow.setResult('Pass');
    flow.submitInspection();
    expect(flow.step()).toBe('inspect');
    expect(flow.error()).not.toBeNull();

    flow.submitInspection();

    expect(createInspection).toHaveBeenCalledTimes(1);
    expect(updateInspection).toHaveBeenCalledTimes(2);
    expect(updateInspection).toHaveBeenNthCalledWith(2, 11, expect.objectContaining({ status: 'Passed' }));
    expect(flow.step()).toBe('done');
  });
});
