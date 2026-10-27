import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { ScanContext, ScanIssueContextJob } from '../../../../shared/models/scan-action.model';
import { ScanIssueSource } from '../../../../shared/models/scan-issue-source.model';
import { ScannerService } from '../../../../shared/services/scanner.service';
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

const SOON: ScanIssueSource = {
  binContentId: 11, locationId: 3, locationPath: 'Rack / A1', locationBarcode: 'BIN-A1', lotNumber: 'L-SOON',
  expirationDate: '2026-11-01', availableQuantity: 4,
};
const LATE: ScanIssueSource = {
  binContentId: 12, locationId: 8, locationPath: 'Rack / B2', locationBarcode: 'BIN-B2', lotNumber: 'L-LATE',
  expirationDate: '2027-01-01', availableQuantity: 30,
};

interface IssueInternals {
  ngOnInit: () => void;
  jobs: () => ScanIssueContextJob[];
  sources: () => ScanIssueSource[];
  selectedSource: () => ScanIssueSource | null;
  sourceNotice: () => string | null;
  step: () => string;
  quantity: () => number;
  maxQuantity: () => number;
  selectAll: () => void;
  continueToQuantity: () => void;
  useCode: (code: string) => void;
  submit: () => void;
}

function setup(context: ScanContext, sources: ScanIssueSource[] = [SOON, LATE]) {
  const issue = vi.fn(() => of(1));
  const getIssueSources = vi.fn(() => of(sources));
  const lastScan = signal<{ value: string; context: string } | null>(null);
  TestBed.configureTestingModule({
    providers: [
      { provide: ScanActionService, useValue: { issue, getIssueSources } },
      { provide: ScannerService, useValue: { lastScan, clearLastScan: vi.fn(() => lastScan.set(null)) } },
      { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new ScanIssueFlowComponent());
  mockSignalInputs(component, { context });
  const flow = component as unknown as IssueInternals;
  flow.ngOnInit();
  return { flow, issue, getIssueSources, lastScan };
}

describe('ScanIssueFlowComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('lists the work orders from the Issue action context', () => {
    const second = { ...JOB, jobId: 2, jobNumber: 'J-2' };
    const { flow } = setup(contextWith([JOB, second]));

    expect(flow.jobs().map(j => j.jobNumber)).toEqual(['J-1', 'J-2']);
    expect(flow.step()).toBe('select-job');
  });

  it('goes straight to the lot choice for a single work order, defaulting to the first-expiring lot', () => {
    const { flow, getIssueSources } = setup(contextWith([JOB]));

    expect(getIssueSources).toHaveBeenCalledWith(5);
    expect(flow.step()).toBe('source');
    expect(flow.selectedSource()).toEqual(SOON);
  });

  it('issues from the chosen bin and lot, capped at what that lot holds', () => {
    const { flow, issue } = setup(contextWith([JOB]));

    flow.continueToQuantity();
    expect(flow.maxQuantity()).toBe(4);
    flow.selectAll();
    flow.submit();

    expect(issue).toHaveBeenCalledWith({ partId: 5, jobId: 1, quantity: 4, fromLocationId: 3, binContentId: 11 });
  });

  it('only offers the lots the server lists as issuable, so a held lot never appears', () => {
    const { flow } = setup(contextWith([JOB]), [LATE]);

    expect(flow.sources().map(s => s.lotNumber)).toEqual(['L-LATE']);
    flow.useCode('L-HELD');

    expect(flow.step()).toBe('source');
    expect(flow.sourceNotice()).toBe('kioskFlows.issue.sourceNotEligible');
  });

  it('selects the lot whose label is scanned and moves on to quantity', () => {
    const { flow, issue } = setup(contextWith([JOB]));

    flow.useCode('l-late');
    expect(flow.selectedSource()).toEqual(LATE);
    expect(flow.step()).toBe('quantity');
    flow.selectAll();
    flow.submit();

    expect(issue).toHaveBeenCalledWith({ partId: 5, jobId: 1, quantity: 7, fromLocationId: 8, binContentId: 12 });
  });

  it('selects by bin label too', () => {
    const { flow } = setup(contextWith([JOB]));

    flow.useCode('BIN-B2');

    expect(flow.selectedSource()).toEqual(LATE);
  });

  it('takes a scanner read while choosing the lot', () => {
    const { flow, lastScan } = setup(contextWith([JOB]));

    lastScan.set({ value: 'L-LATE', context: 'shop-floor' });
    TestBed.tick();

    expect(flow.selectedSource()).toEqual(LATE);
    expect(lastScan()).toBeNull();
  });
});
