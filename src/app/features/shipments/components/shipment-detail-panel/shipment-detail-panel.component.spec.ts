import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { WritableSignal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { ShipmentService } from '../../services/shipment.service';
import { ShipmentDetail } from '../../models/shipment-detail.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ScanLabelDialogComponent } from '../scan-label-dialog/scan-label-dialog.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ShipmentDetailPanelComponent } from './shipment-detail-panel.component';

const DETAIL = {
  id: 7, shipmentNumber: 'SH-0007', status: 'Pending', carrierIsApi: false, carrierRequiresScanToShip: false,
  trackingNumber: null, lines: [],
} as unknown as ShipmentDetail;

interface PanelInternals {
  shipment: WritableSignal<ShipmentDetail | null>;
  markShipped(): void;
}

function setup(dialogResult: unknown) {
  const shipShipment = vi.fn(() => of(undefined));
  const open = vi.fn((_component: unknown) => ({ afterClosed: () => of(dialogResult) }));
  TestBed.configureTestingModule({
    providers: [
      { provide: ShipmentService, useValue: { shipShipment, getShipmentById: vi.fn(() => of(DETAIL)) } },
      { provide: MatDialog, useValue: { open } },
      { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new ShipmentDetailPanelComponent());
  mockSignalInputs(component, { shipmentId: 7 });
  return { panel: component as unknown as PanelInternals, shipShipment, open };
}

describe('ShipmentDetailPanelComponent markShipped', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('asks for the label scan on a scan-to-ship carrier and ships with the scanned code', () => {
    const { panel, shipShipment, open } = setup('v1.SH-0007.abc');
    panel.shipment.set({ ...DETAIL, carrierRequiresScanToShip: true });

    panel.markShipped();

    expect(open.mock.calls[0][0]).toBe(ScanLabelDialogComponent);
    expect(shipShipment).toHaveBeenCalledWith(7, 'v1.SH-0007.abc');
  });

  it('does not ship when the scan dialog is cancelled', () => {
    const { panel, shipShipment } = setup(undefined);
    panel.shipment.set({ ...DETAIL, carrierRequiresScanToShip: true });

    panel.markShipped();

    expect(shipShipment).not.toHaveBeenCalled();
  });

  it('keeps the plain confirmation for a carrier without the scan rule', () => {
    const { panel, shipShipment, open } = setup(true);
    panel.shipment.set(DETAIL);

    panel.markShipped();

    expect(open.mock.calls[0][0]).toBe(ConfirmDialogComponent);
    expect(shipShipment).toHaveBeenCalledWith(7, undefined);
  });
});
