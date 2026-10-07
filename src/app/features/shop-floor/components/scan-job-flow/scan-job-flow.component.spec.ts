import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { ScanJobFlowComponent } from './scan-job-flow.component';
import { ShopFloorService } from '../../services/shop-floor.service';
import { KanbanService } from '../../../kanban/services/kanban.service';
import { JobStatus } from '../../../../shared/models/mobile-api.model';

interface FlowInternals {
  step: () => string;
  error: () => string | null;
  canAdvance: () => boolean;
  advancedTo: () => string | null;
  showAdvanceStage(): void;
  confirmAdvanceStage(): void;
}

function status(nextStageId: number | null, nextStageName = 'QC/Review', nextStageIsShopFloor = true): JobStatus {
  return {
    id: 5, jobNumber: 'JOB-0005', title: 'Bracket', customerName: null,
    stageId: 6, stageName: 'In Production', stageColor: '#000', dueDate: null, isOverdue: false,
    nextStageId, nextStageName: nextStageId ? nextStageName : null,
    nextStageIsShopFloor: nextStageId ? nextStageIsShopFloor : false,
    previousStageId: null, previousStageName: null, rowVersion: 1, recentActivity: [],
  };
}

describe('ScanJobFlowComponent — next status', () => {
  const shopFloor = { getJobStatus: vi.fn(), advanceJob: vi.fn(), completeJob: vi.fn() };

  function create(): FlowInternals {
    const fixture = TestBed.createComponent(ScanJobFlowComponent);
    fixture.componentRef.setInput('jobId', 5);
    fixture.componentRef.setInput('jobNumber', 'JOB-0005');
    fixture.componentRef.setInput('jobTitle', 'Bracket');
    fixture.componentRef.setInput('currentStage', 'In Production');
    fixture.componentInstance.ngOnInit();
    return fixture.componentInstance as unknown as FlowInternals;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [ScanJobFlowComponent],
      providers: [
        { provide: ShopFloorService, useValue: shopFloor },
        { provide: KanbanService, useValue: {} },
        { provide: TranslateService, useValue: { instant: (k: string, p?: Record<string, string>) => p ? `${k}:${JSON.stringify(p)}` : k } },
      ],
    });
    TestBed.overrideComponent(ScanJobFlowComponent, { set: { template: '', imports: [] } });
  });

  afterEach(() => vi.useRealTimers());

  it('advances through the kiosk advance endpoint, not complete-job', () => {
    shopFloor.getJobStatus.mockReturnValue(of(status(7)));
    shopFloor.advanceJob.mockReturnValue(of({
      status: { ...status(null), stageId: 7, stageName: 'QC/Review' },
      previousStageId: 6, previousStageName: 'In Production', collapsed: false,
    }));
    const c = create();

    c.showAdvanceStage();
    expect(c.step()).toBe('confirm-advance');
    c.confirmAdvanceStage();

    expect(shopFloor.advanceJob).toHaveBeenCalledWith(5);
    expect(shopFloor.completeJob).not.toHaveBeenCalled();
    expect(c.step()).toBe('done');
    expect(c.advancedTo()).toBe('QC/Review');
  });

  it('cannot advance when there is no next status', () => {
    shopFloor.getJobStatus.mockReturnValue(of(status(null)));
    const c = create();

    expect(c.canAdvance()).toBe(false);
    c.showAdvanceStage();
    expect(c.step()).toBe('actions');
  });

  it('cannot advance when the next status is an office status', () => {
    shopFloor.getJobStatus.mockReturnValue(of({ ...status(9, 'Invoiced/Sent', false), stageName: 'Shipped' }));
    const c = create();

    expect(c.canAdvance()).toBe(false);
    c.showAdvanceStage();
    expect(c.step()).toBe('actions');
    expect(shopFloor.advanceJob).not.toHaveBeenCalled();
  });

  it('reports a status that failed to load without claiming a move was tried', () => {
    shopFloor.getJobStatus.mockReturnValue(throwError(() =>
      new HttpErrorResponse({ status: 404, error: { detail: 'Job 5 not found' } })));
    const c = create();

    expect(c.canAdvance()).toBe(false);
    expect(c.error()).toBe('shopFloor.jobFlow.statusLoadFailed:{"reason":"Job 5 not found"}');
  });

  it('shows the server reason when the move is refused', () => {
    shopFloor.getJobStatus.mockReturnValue(of(status(7)));
    shopFloor.advanceJob.mockReturnValue(throwError(() =>
      new HttpErrorResponse({ status: 409, error: { detail: 'Open NCR.' } })));
    const c = create();

    c.showAdvanceStage();
    c.confirmAdvanceStage();

    expect(c.step()).toBe('actions');
    expect(c.error()).toBe('shopFloor.jobFlow.advanceFailed:{"reason":"Open NCR."}');
  });
});
