import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { ScanContext } from '../../../../shared/models/scan-action.model';
import { ScanActionService } from '../../../../shared/services/scan-action.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { InventoryService } from '../../../inventory/services/inventory.service';
import { ScanMoveFlowComponent } from './scan-move-flow.component';

const CONTEXT: ScanContext = {
  partId: 5,
  partNumber: 'RM-100',
  description: null,
  currentStock: 6,
  currentLocationName: 'A1',
  currentLocationId: 3,
  availableActions: [],
  stockUomCode: 'EA',
};

interface MoveInternals {
  ngOnInit: () => void;
  step: () => string;
  quantity: () => number;
  locationOptions: () => { value: unknown; label: string }[];
  selectPartial: () => void;
  confirmPartial: () => void;
  partialQty: { setValue: (v: number) => void; touched: boolean; errors: Record<string, { message: string }> | null };
  toLocationId: { setValue: (value: number) => void };
  confirmDestination: () => void;
  submit: () => void;
}

function createFlow(move: ReturnType<typeof vi.fn>): MoveInternals {
  TestBed.configureTestingModule({
    providers: [
      { provide: ScanActionService, useValue: { move } },
      { provide: SnackbarService, useValue: { success: vi.fn(), warn: vi.fn(), errorFrom: vi.fn() } },
      {
        provide: InventoryService,
        useValue: { getBinLocations: () => of([{ id: 3, name: 'A1', locationPath: 'Main / A1' }, { id: 9, name: 'B1', locationPath: 'Main / B1' }]) },
      },
      { provide: TranslateService, useValue: { instant: (key: string, p?: Record<string, unknown>) => p ? `${key} ${JSON.stringify(p)}` : key } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new ScanMoveFlowComponent());
  mockSignalInputs(component, { context: CONTEXT });
  const flow = component as unknown as MoveInternals;
  flow.ngOnInit();
  return flow;
}

describe('ScanMoveFlowComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('offers every bin but the one the stock is in', () => {
    const flow = createFlow(vi.fn());

    expect(flow.locationOptions()).toEqual([{ value: 9, label: 'Main / B1' }]);
  });

  it('says why a partial quantity was not accepted, then moves the accepted one', () => {
    const move = vi.fn(() => of(1));
    const flow = createFlow(move);
    flow.selectPartial();

    flow.partialQty.setValue(7);
    flow.confirmPartial();
    expect(flow.step()).toBe('quantity');
    expect(flow.partialQty.touched).toBe(true);
    expect(flow.partialQty.errors?.['quantity'].message).toBe('kioskFlows.common.quantityAtMost {"max":6}');

    flow.partialQty.setValue(0);
    flow.confirmPartial();
    expect(flow.partialQty.errors?.['quantity'].message).toBe('kioskFlows.common.quantityPositive');

    flow.partialQty.setValue(4);
    flow.confirmPartial();
    expect(flow.step()).toBe('destination');
    flow.toLocationId.setValue(9);
    flow.confirmDestination();
    flow.submit();

    expect(move).toHaveBeenCalledWith({ partId: 5, fromLocationId: 3, toLocationId: 9, quantity: 4 });
  });
});
