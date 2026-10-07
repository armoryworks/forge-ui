import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { QcInspection } from '../../../quality/models/qc-inspection.model';
import { QcTemplate } from '../../../quality/models/qc-template.model';
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

const TEMPLATE: QcTemplate = {
  id: 4,
  name: 'Final',
  description: null,
  partId: 5,
  partNumber: 'P-5',
  isActive: true,
  items: [
    { id: 2, description: 'Fit', specification: '2.5 mm', sortOrder: 2, isRequired: false },
    { id: 1, description: 'Visual', specification: null, sortOrder: 1, isRequired: true },
  ],
};

interface FlowInternals {
  ngOnInit: () => void;
  setResult: (value: 'Pass' | 'Fail') => void;
  submitInspection: () => void;
  step: () => string;
  error: () => string | null;
  checklist: () => { id: number }[];
  checklistForm: { get: (key: string) => { setValue: (value: boolean) => void } | null };
  canPass: () => boolean;
  canSubmit: () => boolean;
}

function setup(updateResponses: unknown[]) {
  const createInspection = vi.fn(() => of(TEMPLATE_INSPECTION));
  const updateInspection = vi.fn(() => updateResponses.shift() as ReturnType<QualityService['updateInspection']>);
  const getTemplates = vi.fn(() => of([TEMPLATE]));
  TestBed.configureTestingModule({
    providers: [{ provide: QualityService, useValue: { createInspection, updateInspection, getTemplates } }],
  });
  const component = TestBed.runInInjectionContext(() => new ScanInspectFlowComponent());
  mockSignalInputs(component, { partId: 5, partNumber: 'P-5', qcTemplateId: 4 });
  const flow = component as unknown as FlowInternals;
  flow.ngOnInit();
  const check = (itemId: number) => flow.checklistForm.get(String(itemId))!.setValue(true);
  return { flow, check, createInspection, updateInspection };
}

describe('ScanInspectFlowComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.useFakeTimers();
  });

  afterEach(() => vi.useRealTimers());

  it('shows the template checklist in sort order', () => {
    const { flow } = setup([]);

    expect(flow.checklist().map(i => i.id)).toEqual([1, 2]);
  });

  it('keeps Pass unavailable until every required item is checked', () => {
    const { flow, check, updateInspection } = setup([of(TEMPLATE_INSPECTION)]);

    flow.setResult('Pass');
    expect(flow.canPass()).toBe(false);
    expect(flow.canSubmit()).toBe(false);

    flow.submitInspection();
    expect(updateInspection).not.toHaveBeenCalled();

    check(1);
    expect(flow.canPass()).toBe(true);
    expect(flow.canSubmit()).toBe(true);
  });

  it('passes with only the items the operator checked marked passed', () => {
    const { flow, check, updateInspection } = setup([of(TEMPLATE_INSPECTION)]);

    check(1);
    flow.setResult('Pass');
    flow.submitInspection();

    expect(updateInspection).toHaveBeenCalledWith(11, {
      status: 'Passed',
      notes: undefined,
      results: [
        { id: 101, checklistItemId: 1, description: 'Visual', passed: true, measuredValue: undefined, notes: undefined },
        { id: 102, checklistItemId: 2, description: 'Fit', passed: false, measuredValue: '2.5', notes: undefined },
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

  it('fails without checking any item', () => {
    const { flow, updateInspection } = setup([of(TEMPLATE_INSPECTION)]);

    flow.setResult('Fail');
    expect(flow.canSubmit()).toBe(true);
    flow.submitInspection();

    expect(updateInspection).toHaveBeenCalledTimes(1);
  });

  it('shows the server reason and retries on the same inspection instead of creating another', () => {
    const reason = 'Inspection 11 cannot pass: required checklist items did not pass (Visual).';
    const { flow, check, createInspection, updateInspection } = setup([
      throwError(() => ({ status: 409, error: { detail: reason } })),
      of(TEMPLATE_INSPECTION),
    ]);

    check(1);
    flow.setResult('Pass');
    flow.submitInspection();
    expect(flow.step()).toBe('inspect');
    expect(flow.error()).toBe(reason);

    flow.submitInspection();

    expect(createInspection).toHaveBeenCalledTimes(1);
    expect(updateInspection).toHaveBeenCalledTimes(2);
    expect(updateInspection).toHaveBeenNthCalledWith(2, 11, expect.objectContaining({ status: 'Passed' }));
    expect(flow.step()).toBe('done');
  });
});
