import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

import { of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { SalesOrderService } from '../../services/sales-order.service';
import { SalesOrderStage, SalesOrderStages } from '../../models/sales-order-stage.model';
import { SalesOrderStagesTabComponent } from './sales-order-stages-tab.component';

interface TabInternals {
  ngOnInit(): void;
  stages: Signal<SalesOrderStages | null>;
  nextSequence: Signal<number>;
  isLocked(stage: SalesOrderStage): boolean;
  deleteStage(stage: SalesOrderStage): void;
}

function stage(id: number, status: SalesOrderStage['status']): SalesOrderStage {
  return {
    id, sequence: id, name: `S${id}`, status, plannedProductionComplete: null, plannedShipDate: null, actualShipDate: null,
    shipmentId: null, shipmentNumber: null, paymentMilestoneId: null, paymentMilestoneName: null, notes: null, lines: [], lots: [],
  };
}

describe('SalesOrderStagesTabComponent', () => {
  it('loads the schedule, locks shipped stages and deletes after confirmation', () => {
    const schedule: SalesOrderStages = { salesOrderId: 7, isActivated: true, stages: [stage(1, 'Shipped'), stage(2, 'Planned')], derivedTimeline: [] };
    const getStages = vi.fn(() => of(schedule));
    const deleteStage = vi.fn(() => of(undefined));
    TestBed.configureTestingModule({
      providers: [
        { provide: SalesOrderService, useValue: { getStages, deleteStage } },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(true) }) } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new SalesOrderStagesTabComponent());
    mockSignalInputs(component, { salesOrderId: 7, lines: [] });
    const tab = component as unknown as TabInternals;
    tab.ngOnInit();

    expect(getStages).toHaveBeenCalledWith(7);
    expect(tab.nextSequence()).toBe(3);
    expect(tab.isLocked(schedule.stages[0])).toBe(true);
    expect(tab.isLocked(schedule.stages[1])).toBe(false);

    tab.deleteStage(schedule.stages[1]);
    expect(deleteStage).toHaveBeenCalledWith(2);
    expect(getStages).toHaveBeenCalledTimes(2);
  });
});
