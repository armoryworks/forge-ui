import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { ScanContext, ScanReceiveContextLine } from '../../../../shared/models/scan-action.model';
import { ScanActionService } from '../../../../shared/services/scan-action.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { InventoryService } from '../../../inventory/services/inventory.service';
import { ScanReceiveFlowComponent } from './scan-receive-flow.component';

const LINE: ScanReceiveContextLine = {
  purchaseOrderLineId: 31, poNumber: 'PO-0007', expectedQuantity: 10, receivedQuantity: 4, remainingQuantity: 6,
};

const CONTEXT: ScanContext = {
  partId: 5,
  partNumber: 'RM-100',
  description: null,
  currentStock: 0,
  currentLocationName: null,
  currentLocationId: null,
  availableActions: [{ action: 'Receive', enabled: true, disabledReason: null, context: { poLines: [LINE] } }],
};

interface ReceiveInternals {
  ngOnInit: () => void;
  poLines: () => ScanReceiveContextLine[];
  step: () => string;
  selectAll: () => void;
  toLocationId: { setValue: (value: number) => void };
  lotNumber: { setValue: (value: string) => void };
  confirmDestination: () => void;
  submit: () => void;
}

function createFlow(context: ScanContext, receive: ReturnType<typeof vi.fn>): ReceiveInternals {
  TestBed.configureTestingModule({
    providers: [
      { provide: ScanActionService, useValue: { receive } },
      { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
      { provide: InventoryService, useValue: { getBinLocations: () => of([{ id: 9, name: 'B1', locationPath: 'Main / B1' }]) } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new ScanReceiveFlowComponent());
  mockSignalInputs(component, { context });
  const flow = component as unknown as ReceiveInternals;
  flow.ngOnInit();
  return flow;
}

describe('ScanReceiveFlowComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('reads the open PO lines from the Receive action context and receives into the chosen bin', () => {
    const receive = vi.fn(() => of(1));
    TestBed.configureTestingModule({
      providers: [
        { provide: ScanActionService, useValue: { receive } },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
        { provide: InventoryService, useValue: { getBinLocations: () => of([{ id: 9, name: 'B1', locationPath: 'Main / B1' }]) } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new ScanReceiveFlowComponent());
    mockSignalInputs(component, { context: CONTEXT });
    const flow = component as unknown as ReceiveInternals;
    flow.ngOnInit();

    expect(flow.poLines()).toEqual([LINE]);
    expect(flow.step()).toBe('quantity');
    flow.selectAll();
    flow.toLocationId.setValue(9);
    flow.confirmDestination();
    flow.submit();

    expect(receive).toHaveBeenCalledWith({ partId: 5, purchaseOrderLineId: 31, quantity: 6, toLocationId: 9 });
  });

  it('lets a lot-tracked line go through without a lot, and sends the trimmed lot when one is entered', () => {
    const receive = vi.fn(() => of(1));
    const lotLine: ScanReceiveContextLine = { ...LINE, lotTracked: true };
    const flow = createFlow(
      { ...CONTEXT, availableActions: [{ action: 'Receive', enabled: true, disabledReason: null, context: { poLines: [lotLine] } }] },
      receive);

    flow.selectAll();
    flow.toLocationId.setValue(9);
    flow.confirmDestination();
    expect(flow.step()).toBe('confirm');

    flow.lotNumber.setValue(' HT-77 ');
    flow.confirmDestination();
    expect(flow.step()).toBe('confirm');
    flow.submit();

    expect(receive).toHaveBeenCalledWith({ partId: 5, purchaseOrderLineId: 31, quantity: 6, toLocationId: 9, lotNumber: 'HT-77' });
  });

  it('says why a partial quantity was not accepted instead of doing nothing', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: ScanActionService, useValue: { receive: vi.fn() } },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
        { provide: InventoryService, useValue: { getBinLocations: () => of([]) } },
        { provide: TranslateService, useValue: { instant: (key: string, p?: Record<string, unknown>) => p ? `${key} ${JSON.stringify(p)}` : key } },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new ScanReceiveFlowComponent());
    mockSignalInputs(component, { context: CONTEXT });
    const flow = component as unknown as ReceiveInternals & {
      selectPartial: () => void;
      confirmPartial: () => void;
      partialQty: { setValue: (v: number) => void; touched: boolean; errors: Record<string, { message: string }> | null };
    };
    flow.ngOnInit();
    flow.selectPartial();

    flow.partialQty.setValue(9);
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
  });
});
