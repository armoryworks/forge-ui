import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { ScanJobFlowComponent } from './scan-job-flow.component';
import { ShopFloorService } from '../../services/shop-floor.service';
import { KanbanService } from '../../../kanban/services/kanban.service';
import { SpcService } from '../../../quality/services/spc.service';
import { SpcCharacteristic } from '../../../quality/models/spc.model';
import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { OperationQuantityDialogResult } from '../../../../shared/models/operation-quantity-dialog-result.model';
import { JobOperationRow } from '../../models/job-operation-row.model';
import { JobOperations } from '../../models/job-operations.model';
import { SpcRecordDialogComponent } from '../spc-record-dialog/spc-record-dialog.component';

interface FloorInternals {
  spcCharacteristics: () => SpcCharacteristic[];
  operationNotice: () => string | null;
  openQuantity(row: JobOperationRow): void;
  openSpc(row: JobOperationRow): void;
}

function opRow(stepNumber: number, overrides: Partial<JobOperationRow> = {}): JobOperationRow {
  return {
    operationId: 100 + stepNumber, jobOperationId: null, version: null, stepNumber, title: `Step ${stepNumber}`,
    workCenterName: null, isRoutingStep: true, status: 'InProgress', completedQuantity: 0, scrapQuantity: 0,
    startedAt: null, completedAt: null, completedByName: null,
    estimatedSetupMinutes: 0, estimatedRunMinutesEach: 1, estimatedRunMinutesLot: 0, estimatedTotalMinutes: 40,
    actualSetupMinutes: 0, actualRunMinutes: 0, actualOtherMinutes: 0, actualTotalMinutes: 0,
    actualRunMinutesEach: null, remainingMinutes: 40, historyRunMinutesEach: null, historyJobCount: 0, openTimers: [],
    ...overrides,
  };
}

const RUNNING = opRow(3, {
  openTimers: [{ timeEntryId: 9, userId: 3, userName: 'Pat', userInitials: 'PD', entryType: 'Run', timerStart: '2026-10-26T12:00:00Z' }],
});

function operations(rows: JobOperationRow[]): JobOperations {
  return {
    jobId: 5, jobQuantity: 40, trackingEnabled: true, allOperationsComplete: false,
    estimatedRemainingMinutes: 80, serverNow: new Date().toISOString(), operations: rows,
  };
}

function characteristic(id: number, operationId: number | null): SpcCharacteristic {
  return {
    id, partId: 1, partNumber: 'SHAFT', operationId, operationName: null, name: `C${id}`, description: null,
    measurementType: 'Variable' as SpcCharacteristic['measurementType'], nominalValue: 10, upperSpecLimit: 10.1, lowerSpecLimit: 9.9,
    unitOfMeasure: 'mm', decimalPlaces: 3, sampleSize: 5, sampleFrequency: null, gageId: null, isActive: true, notifyOnOoc: true,
    measurementCount: 0, latestCpk: null,
  };
}

describe('ScanJobFlowComponent — SPC and rework time on the kiosk', () => {
  let spcOn = true;
  let dialogResult: OperationQuantityDialogResult | undefined;
  const shopFloor = {
    getJobStatus: vi.fn(() => of({ nextStageId: null })),
    getConfig: vi.fn(() => of({ operationTracking: true, reasons: [] })),
    getOperations: vi.fn(() => of(operations([opRow(2), RUNNING]))),
    getActiveTimers: vi.fn(() => of([])),
    startOperationTimer: vi.fn(() => of({ entry: {}, alreadyRunning: false, operation: RUNNING })),
    stopOperationTimer: vi.fn(() => of({ stopped: true, entry: null })),
    updateOperationProgress: vi.fn(() => of({ operation: RUNNING, allOperationsComplete: false, estimatedRemainingMinutes: 10 })),
  };
  const spc = { getJobCharacteristics: vi.fn(() => of([characteristic(1, 103), characteristic(2, null)])) };
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(dialogResult) })) };

  function create(): FloorInternals {
    const fixture = TestBed.createComponent(ScanJobFlowComponent);
    fixture.componentRef.setInput('jobId', 5);
    fixture.componentRef.setInput('jobNumber', 'JOB-0005');
    fixture.componentRef.setInput('jobTitle', 'Shafts');
    fixture.componentRef.setInput('currentStage', 'In Production');
    fixture.componentInstance.ngOnInit();
    return fixture.componentInstance as unknown as FloorInternals;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    spcOn = true;
    dialogResult = undefined;
    TestBed.configureTestingModule({
      imports: [ScanJobFlowComponent],
      providers: [
        { provide: ShopFloorService, useValue: shopFloor },
        { provide: SpcService, useValue: spc },
        { provide: MatDialog, useValue: dialog },
        { provide: KanbanService, useValue: {} },
        { provide: AuthService, useValue: { user: () => ({ id: 3 }), hasAnyRole: () => false } },
        { provide: CapabilityService, useValue: { isEnabled: (code: string) => code !== 'CAP-QC-SPC' || spcOn } },
        { provide: TranslateService, useValue: { instant: (k: string) => k } },
      ],
    });
    TestBed.overrideComponent(ScanJobFlowComponent, { set: { template: '', imports: [] } });
  });

  afterEach(() => vi.useRealTimers());

  it('loads the job\'s SPC characteristics when SPC is on', () => {
    const c = create();

    expect(spc.getJobCharacteristics).toHaveBeenCalledWith(5);
    expect(c.spcCharacteristics().map(x => x.id)).toEqual([1, 2]);
  });

  it('does not ask for characteristics when SPC is off', () => {
    spcOn = false;
    const c = create();

    expect(spc.getJobCharacteristics).not.toHaveBeenCalled();
    expect(c.spcCharacteristics()).toEqual([]);
  });

  it('opens SPC entry with the step\'s own and the part-wide characteristics', () => {
    const c = create();

    c.openSpc(opRow(2));
    const [component, config] = dialog.open.mock.calls[0] as unknown as [unknown, { data: { jobId: number; characteristics: SpcCharacteristic[] } }];

    expect(component).toBe(SpcRecordDialogComponent);
    expect(config.data.jobId).toBe(5);
    expect(config.data.characteristics.map(x => x.id)).toEqual([2]);
  });

  it('tells the dialog a Run timer is open so it can offer rework time', () => {
    const c = create();

    c.openQuantity(RUNNING);
    const config = (dialog.open.mock.calls[0] as unknown[])[1] as { data: { runTimerOpen: boolean } };

    expect(config.data.runTimerOpen).toBe(true);
  });

  it('books rework time by stopping the Run timer and starting a Rework timer', () => {
    dialogResult = {
      completedQuantity: 0, scrapQuantity: 0, reworkQuantity: 2, reasonCode: null, complete: false,
      addedQuantity: 0, addedScrap: 0, bookReworkTime: true,
    };
    const c = create();

    c.openQuantity(RUNNING);

    expect(shopFloor.updateOperationProgress).toHaveBeenCalledWith(5, 103, expect.objectContaining({ reworkQuantity: 2 }));
    expect(shopFloor.stopOperationTimer).toHaveBeenCalledWith(5, 103);
    expect(shopFloor.startOperationTimer).toHaveBeenCalledWith(5, 103, 'Rework');
    expect(c.operationNotice()).toBe('shopFloor.operations.reworkBooked');
  });

  it('leaves the timers alone when the operator says they are already on rework', () => {
    dialogResult = {
      completedQuantity: 0, scrapQuantity: 0, reworkQuantity: 2, reasonCode: null, complete: false,
      addedQuantity: 0, addedScrap: 0,
    };
    const c = create();

    c.openQuantity(RUNNING);

    expect(shopFloor.updateOperationProgress).toHaveBeenCalled();
    expect(shopFloor.stopOperationTimer).not.toHaveBeenCalled();
    expect(shopFloor.startOperationTimer).not.toHaveBeenCalled();
  });
});
