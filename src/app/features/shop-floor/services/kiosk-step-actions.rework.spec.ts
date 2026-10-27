import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { KioskStepActionsService } from './kiosk-step-actions.service';
import { ShopFloorService } from './shop-floor.service';
import { JobOperationRow } from '../models/job-operation-row.model';
import { OperationQuantityDialogResult } from '../../../shared/models/operation-quantity-dialog-result.model';
import { AuthService } from '../../../shared/services/auth.service';
import { StepGateService } from '../../../shared/services/step-gate.service';

function row(entryType: string | null): JobOperationRow {
  return {
    operationId: 401, jobOperationId: 9, version: 3, stepNumber: 30, title: 'Grind', workCenterName: null, isRoutingStep: true,
    status: 'InProgress', completedQuantity: 10, scrapQuantity: 0, startedAt: null, completedAt: null,
    completedByName: null, estimatedSetupMinutes: 0, estimatedRunMinutesEach: 1, estimatedRunMinutesLot: 0, estimatedTotalMinutes: 40,
    actualSetupMinutes: 0, actualRunMinutes: 0, actualOtherMinutes: 0, actualTotalMinutes: 0, actualRunMinutesEach: null,
    remainingMinutes: 30, historyRunMinutesEach: null, historyJobCount: 0,
    openTimers: entryType ? [{ timeEntryId: 1, userId: 3, userName: 'Pat', userInitials: 'PD', entryType, timerStart: '2026-10-26T12:00:00Z' }] : [],
  };
}

describe('KioskStepActionsService · rework time', () => {
  const shopFloor = {
    stopOperationTimer: vi.fn(() => of({ stopped: true, entry: null })),
    startOperationTimer: vi.fn(() => of({ entry: {}, alreadyRunning: false, operation: row('Rework') })),
    updateOperationProgress: vi.fn(() => of({ operation: row('Run'), allOperationsComplete: false, estimatedRemainingMinutes: 10 })),
  };
  let result: OperationQuantityDialogResult | undefined;
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(result) })) };
  const context = { jobQuantity: 40, decimalPlaces: 0, reasons: [] };
  let service: KioskStepActionsService;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: ShopFloorService, useValue: shopFloor },
        { provide: MatDialog, useValue: dialog },
        { provide: TranslateService, useValue: { instant: (k: string) => k } },
        { provide: StepGateService, useValue: { gateFor: () => null } },
        { provide: AuthService, useValue: { user: () => ({ id: 3 }) } },
      ],
    });
    service = TestBed.inject(KioskStepActionsService);
  });

  it('tells the dialog only when my own Run timer is open on the step', () => {
    service.recordPieces(41, row('Run'), context).subscribe();
    service.recordPieces(41, row('Setup'), context).subscribe();

    const data = dialog.open.mock.calls.map(call => ((call as unknown[])[1] as { data: { runTimerOpen: boolean } }).data.runTimerOpen);
    expect(data).toEqual([true, false]);
  });

  it('records the rework count, then swaps the Run timer for a Rework timer', () => {
    result = { completedQuantity: 10, scrapQuantity: 0, reworkQuantity: 3, reasonCode: null, complete: false, addedQuantity: 0, addedScrap: 0, bookReworkTime: true };

    service.recordPieces(41, row('Run'), context).subscribe();

    expect(shopFloor.updateOperationProgress).toHaveBeenCalledWith(41, 401, expect.objectContaining({ reworkQuantity: 3 }));
    expect(shopFloor.stopOperationTimer).toHaveBeenCalledWith(41, 401);
    expect(shopFloor.startOperationTimer).toHaveBeenCalledWith(41, 401, 'Rework');
  });

  it('keeps the timers when rework time is not booked', () => {
    result = { completedQuantity: 10, scrapQuantity: 0, reworkQuantity: 3, reasonCode: null, complete: false, addedQuantity: 0, addedScrap: 0 };

    service.recordPieces(41, row('Run'), context).subscribe();

    expect(shopFloor.stopOperationTimer).not.toHaveBeenCalled();
    expect(shopFloor.startOperationTimer).not.toHaveBeenCalled();
  });
});
