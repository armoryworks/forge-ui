import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { ScanContext, ScanIssueContextJob } from '../../../../shared/models/scan-action.model';
import { ScanActionService } from '../../../../shared/services/scan-action.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ScanIssueFlowComponent } from './scan-issue-flow.component';

const JOB: ScanIssueContextJob = {
  jobId: 1, jobNumber: 'J-1', title: 'Bracket run', requiredQuantity: 10, issuedQuantity: 3, remainingQuantity: 7,
};

function contextWith(jobs: ScanIssueContextJob[]): ScanContext {
  return {
    partId: 5,
    partNumber: 'RM-100',
    description: null,
    currentStock: 40,
    currentLocationName: 'A1',
    currentLocationId: 3,
    availableActions: [{ action: 'Issue', enabled: true, disabledReason: null, context: { jobs } }],
  };
}

interface IssueInternals {
  ngOnInit: () => void;
  jobs: () => ScanIssueContextJob[];
  step: () => string;
  quantity: () => number;
  selectAll: () => void;
  submit: () => void;
}

function setup(context: ScanContext) {
  const issue = vi.fn(() => of(1));
  TestBed.configureTestingModule({
    providers: [
      { provide: ScanActionService, useValue: { issue } },
      { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new ScanIssueFlowComponent());
  mockSignalInputs(component, { context });
  const flow = component as unknown as IssueInternals;
  flow.ngOnInit();
  return { flow, issue };
}

describe('ScanIssueFlowComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('lists the work orders from the Issue action context', () => {
    const second = { ...JOB, jobId: 2, jobNumber: 'J-2' };
    const { flow } = setup(contextWith([JOB, second]));

    expect(flow.jobs().map(j => j.jobNumber)).toEqual(['J-1', 'J-2']);
    expect(flow.step()).toBe('select-job');
  });

  it('goes straight to quantity for a single work order and issues the remaining amount', () => {
    const { flow, issue } = setup(contextWith([JOB]));

    expect(flow.step()).toBe('quantity');
    flow.selectAll();
    flow.submit();

    expect(issue).toHaveBeenCalledWith({ partId: 5, jobId: 1, quantity: 7, fromLocationId: 3 });
  });
});
