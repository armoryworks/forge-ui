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
  confirmDestination: () => void;
  submit: () => void;
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
});
