import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { ScanShipContextLine } from '../../../../shared/models/scan-ship-context-line.model';
import { ShipmentService } from '../../../shipments/services/shipment.service';
import { ScanShipFlowComponent } from './scan-ship-flow.component';

const LINE: ScanShipContextLine = {
  shipmentLineId: 11, shipmentId: 4, shipmentNumber: 'SH-0001', salesOrderNumber: 'SO-0003', requiredQuantity: 6,
  requiresScanToShip: false,
};

interface ShipInternals {
  selectLine: (line: ScanShipContextLine) => void;
  shipAll: () => void;
  confirmShip: () => void;
  error: () => string | null;
}

function setup(shipShipment: ReturnType<typeof vi.fn>, scanned: string | undefined = undefined) {
  const open = vi.fn(() => ({ afterClosed: () => of(scanned) }));
  TestBed.configureTestingModule({
    providers: [
      { provide: ShipmentService, useValue: { shipShipment } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
      { provide: MatDialog, useValue: { open } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new ScanShipFlowComponent());
  return { component, open };
}

describe('ScanShipFlowComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('ships the shipment the selected line belongs to, not the line id', () => {
    const shipShipment = vi.fn(() => of(undefined));
    const { component, open } = setup(shipShipment);
    mockSignalInputs(component, { partId: 5, partNumber: 'RM-100', openShipmentLines: [LINE] });
    const flow = component as unknown as ShipInternals;

    flow.selectLine(LINE);
    flow.shipAll();
    flow.confirmShip();

    expect(open).not.toHaveBeenCalled();
    expect(shipShipment).toHaveBeenCalledWith(4, undefined);
  });

  it('asks for the label scan when the carrier requires it and ships with the scanned code', () => {
    const shipShipment = vi.fn(() => of(undefined));
    const scanLine = { ...LINE, requiresScanToShip: true };
    const { component, open } = setup(shipShipment, 'v1.SH-0001.abc');
    mockSignalInputs(component, { partId: 5, partNumber: 'RM-100', openShipmentLines: [scanLine] });
    const flow = component as unknown as ShipInternals;

    flow.selectLine(scanLine);
    flow.shipAll();
    flow.confirmShip();

    expect(open).toHaveBeenCalledOnce();
    expect(shipShipment).toHaveBeenCalledWith(4, 'v1.SH-0001.abc');
  });

  it('does not ship when the label scan is cancelled', () => {
    const shipShipment = vi.fn(() => of(undefined));
    const scanLine = { ...LINE, requiresScanToShip: true };
    const { component } = setup(shipShipment, undefined);
    mockSignalInputs(component, { partId: 5, partNumber: 'RM-100', openShipmentLines: [scanLine] });
    const flow = component as unknown as ShipInternals;

    flow.selectLine(scanLine);
    flow.shipAll();
    flow.confirmShip();

    expect(shipShipment).not.toHaveBeenCalled();
  });

  it('shows the reason the server gave for refusing the shipment', () => {
    const refusal = new HttpErrorResponse({
      status: 409,
      error: { detail: 'This shipment uses an integrated carrier — create the shipping label first.' },
    });
    const shipShipment = vi.fn(() => throwError(() => refusal));
    const { component } = setup(shipShipment);
    mockSignalInputs(component, { partId: 5, partNumber: 'RM-100', openShipmentLines: [LINE] });
    const flow = component as unknown as ShipInternals;

    flow.selectLine(LINE);
    flow.shipAll();
    flow.confirmShip();

    expect(flow.error()).toBe('This shipment uses an integrated carrier — create the shipping label first.');
  });
});
