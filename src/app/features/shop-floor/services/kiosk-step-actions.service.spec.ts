import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { KioskStepActionsService } from './kiosk-step-actions.service';
import { ShopFloorService } from './shop-floor.service';
import { JobOperationRow } from '../models/job-operation-row.model';
import { OperationQuantityDialogResult } from '../../../shared/models/operation-quantity-dialog-result.model';

function row(overrides: Partial<JobOperationRow> = {}): JobOperationRow {
  return {
    operationId: 401, jobOperationId: 9, version: 3, stepNumber: 2, title: 'Turn', workCenterName: null, isRoutingStep: true,
    status: 'InProgress', completedQuantity: 10, scrapQuantity: 1, plannedQuantity: 42, startedAt: null, completedAt: null,
    completedByName: null, estimatedSetupMinutes: 0, estimatedRunMinutesEach: 1, estimatedRunMinutesLot: 0, estimatedTotalMinutes: 40,
    actualSetupMinutes: 0, actualRunMinutes: 0, actualOtherMinutes: 0, actualTotalMinutes: 0, actualRunMinutesEach: null,
    remainingMinutes: 30, historyRunMinutesEach: null, historyJobCount: 0, openTimers: [],
    ...overrides,
  };
}

describe('KioskStepActionsService', () => {
  const shopFloor = {
    getOperations: vi.fn(() => of({ jobId: 41, jobQuantity: 40, operations: [row()], quantityDecimalPlaces: 0 })),
    getConfig: vi.fn(() => of({ operationTracking: true, reasons: [{ code: 'chatter', label: 'Chatter' }] })),
    stopOperationTimer: vi.fn((_jobId: number, _operationId: number, _request?: unknown) => of({ stopped: true, entry: null })),
    updateOperationProgress: vi.fn(() => of({ operation: row(), allOperationsComplete: false, estimatedRemainingMinutes: 10 })),
  };
  let result: OperationQuantityDialogResult | undefined;
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(result) })) };
  let service: KioskStepActionsService;
  const context = { jobQuantity: 40, decimalPlaces: 0, reasons: [] };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: ShopFloorService, useValue: shopFloor },
        { provide: MatDialog, useValue: dialog },
        { provide: TranslateService, useValue: { instant: (k: string) => k } },
      ],
    });
    service = TestBed.inject(KioskStepActionsService);
  });

  it('loads one step with its job quantity, decimals and reasons', () => {
    let loaded: unknown;
    service.loadStep(41, 401).subscribe(step => loaded = step);
    expect(loaded).toEqual({ row: row(), context: { jobQuantity: 40, decimalPlaces: 0, reasons: [{ code: 'chatter', label: 'Chatter' }] } });
  });

  it('stopping a run timer sends only the pieces entered and a Done', () => {
    result = { completedQuantity: 16, scrapQuantity: 2, reworkQuantity: 0, reasonCode: 'chatter', complete: true, addedQuantity: 6, addedScrap: 1 };
    service.stop(41, row(), context, 'Run').subscribe();

    const data = (dialog.open.mock.calls[0] as unknown[])[1] as { data: { mode: string; plannedQuantity: number } };
    expect(data.data).toMatchObject({ mode: 'stop', plannedQuantity: 42 });
    expect(shopFloor.stopOperationTimer).toHaveBeenCalledWith(41, 401, { goodQuantity: 6, scrapQuantity: 1, markComplete: true, reasonCode: 'chatter' });
  });

  it('a setup timer stops without asking', () => {
    service.stop(41, row(), context, 'Setup').subscribe();
    expect(dialog.open).not.toHaveBeenCalled();
    expect(shopFloor.stopOperationTimer).toHaveBeenCalledWith(41, 401);
  });

  it('record pieces sends absolute totals with the row version', () => {
    result = { completedQuantity: 14, scrapQuantity: 1, reworkQuantity: 0, reasonCode: null, complete: false, addedQuantity: 4, addedScrap: 0 };
    service.recordPieces(41, row(), context).subscribe();
    expect(shopFloor.updateOperationProgress).toHaveBeenCalledWith(41, 401,
      { completedQuantity: 14, scrapQuantity: 1, status: null, expectedVersion: 3 });
  });
});
