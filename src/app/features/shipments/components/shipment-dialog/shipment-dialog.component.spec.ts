import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { ShipmentService } from '../../services/shipment.service';
import { SalesOrderService } from '../../../sales-orders/services/sales-order.service';
import { SalesOrderLine } from '../../../sales-orders/models/sales-order-line.model';
import { CarrierService } from '../../../admin/services/carrier.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ManualNumberSettingsService } from '../../../../shared/services/manual-number-settings.service';
import { ShipmentDialogComponent } from './shipment-dialog.component';

function orderLine(id: number, remaining: number, partNumber: string): SalesOrderLine {
  return {
    id, partId: id * 10, partNumber, description: `Line ${id}`, quantity: remaining, unitPrice: 1, lineTotal: remaining,
    lineNumber: id, shippedQuantity: 0, remainingQuantity: remaining, isFullyShipped: remaining === 0, notes: null,
    jobs: [], needsJob: false,
  };
}

interface DialogInternals {
  ngOnInit(): void;
  shipmentForm: FormGroup<{
    salesOrderId: FormControl<number | null>;
    carrierId: FormControl<number | null>;
    carrier: FormControl<string | null>;
  }>;
  lineForm: FormGroup<{ salesOrderLineId: FormControl<number | null>; quantity: FormControl<number | null> }>;
  lines(): { salesOrderLineId: number; quantity: number; partNumber: string }[];
  orderLineOptions(): { value: unknown; label: string }[];
  usesListedCarrier(): boolean;
}

function setup(initialSalesOrderId: number | null, lines: SalesOrderLine[]) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: ShipmentService, useValue: { createShipment: vi.fn(() => of(undefined)) } },
      {
        provide: SalesOrderService,
        useValue: { getSalesOrders: () => of([]), getSalesOrderById: () => of({ lines }) },
      },
      { provide: CarrierService, useValue: { list: () => of([]) } },
      { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn() } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
      { provide: ManualNumberSettingsService, useValue: { isEnabled: () => false } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new ShipmentDialogComponent());
  mockSignalInputs(component, { initialSalesOrderId });
  const internals = component as unknown as DialogInternals;
  internals.ngOnInit();
  return internals;
}

describe('ShipmentDialogComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('starts a scoped shipment with every line still to ship at its remaining quantity', () => {
    const dialog = setup(40, [orderLine(1, 24000, 'RS-1'), orderLine(2, 0, 'RS-2'), orderLine(3, 2.5, 'RS-3')]);

    expect(dialog.lines()).toEqual([
      expect.objectContaining({ salesOrderLineId: 1, quantity: 24000, partNumber: 'RS-1' }),
      expect.objectContaining({ salesOrderLineId: 3, quantity: 2.5, partNumber: 'RS-3' }),
    ]);
  });

  it('leaves service lines out of a scoped shipment because they ship no goods', () => {
    const dialog = setup(40, [orderLine(1, 24000, 'RS-1'), { ...orderLine(2, 1, 'SVC-SETUP'), shipsGoods: false }]);

    expect(dialog.lines()).toEqual([expect.objectContaining({ salesOrderLineId: 1, quantity: 24000 })]);
  });

  it('does not prefill lines when the user picks the order by hand', () => {
    const dialog = setup(null, [orderLine(1, 24000, 'RS-1')]);

    dialog.shipmentForm.controls.salesOrderId.setValue(40);

    expect(dialog.lines()).toEqual([]);
    expect(dialog.orderLineOptions().map(o => o.label)).toEqual(['RS-1 — Line 1 · 24,000 shipments.remainingShort']);
  });

  it('marks a line quantity over what is left to ship as invalid, so Add stays disabled', () => {
    const dialog = setup(null, [orderLine(1, 24000, 'RS-1')]);
    dialog.shipmentForm.controls.salesOrderId.setValue(40);

    dialog.lineForm.controls.salesOrderLineId.setValue(1);
    expect(dialog.lineForm.controls.quantity.value).toBe(24000);
    dialog.lineForm.controls.quantity.setValue(999999);

    expect(dialog.lineForm.controls.quantity.errors).toEqual({ max: { max: 24000, actual: 999999 } });
    expect(dialog.lineForm.invalid).toBe(true);
  });

  it('uses the free-text carrier only when no listed carrier is picked', () => {
    const dialog = setup(null, []);
    dialog.shipmentForm.controls.carrier.setValue('Local courier');
    expect(dialog.usesListedCarrier()).toBe(false);

    dialog.shipmentForm.controls.carrierId.setValue(3);

    expect(dialog.usesListedCarrier()).toBe(true);
    expect(dialog.shipmentForm.controls.carrier.value).toBe('');
  });
});
