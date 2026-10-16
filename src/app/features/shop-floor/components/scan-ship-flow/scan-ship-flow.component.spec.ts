import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { ScanShipContextLine } from '../../../../shared/models/scan-ship-context-line.model';
import { ShipmentService } from '../../../shipments/services/shipment.service';
import { ScanShipFlowComponent } from './scan-ship-flow.component';

const LINE: ScanShipContextLine = {
  shipmentLineId: 11, shipmentId: 4, shipmentNumber: 'SH-0001', salesOrderNumber: 'SO-0003', requiredQuantity: 6,
};

interface ShipInternals {
  selectLine: (line: ScanShipContextLine) => void;
  shipAll: () => void;
  confirmShip: () => void;
}

describe('ScanShipFlowComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('ships the shipment the selected line belongs to, not the line id', () => {
    const shipShipment = vi.fn(() => of(undefined));
    TestBed.configureTestingModule({
      providers: [
        { provide: ShipmentService, useValue: { shipShipment } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new ScanShipFlowComponent());
    mockSignalInputs(component, { partId: 5, partNumber: 'RM-100', openShipmentLines: [LINE] });
    const flow = component as unknown as ShipInternals;

    flow.selectLine(LINE);
    flow.shipAll();
    flow.confirmShip();

    expect(shipShipment).toHaveBeenCalledWith(4);
  });
});
