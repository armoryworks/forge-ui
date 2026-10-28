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
import { AuthService } from '../../../../shared/services/auth.service';
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
  lineForm: FormGroup<{ salesOrderLineId: FormControl<number | null>; quantity: FormControl<number | null>; overReason: FormControl<string> }>;
  lines(): { salesOrderLineId: number; quantity: number; partNumber: string; overToleranceReason?: string }[];
  entryOverTolerance(): boolean;
  addLine(): void;
  orderLineOptions(): { value: unknown; label: string }[];
  usesListedCarrier(): boolean;
}

function setup(initialSalesOrderId: number | null, lines: SalesOrderLine[], roles: string[] = []) {
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
      { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
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

  it('refuses a line quantity over the tolerance for a user who cannot accept it', () => {
    const dialog = setup(null, [orderLine(1, 24000, 'RS-1')]);
    dialog.shipmentForm.controls.salesOrderId.setValue(40);

    dialog.lineForm.controls.salesOrderLineId.setValue(1);
    expect(dialog.lineForm.controls.quantity.value).toBe(24000);
    dialog.lineForm.controls.quantity.setValue(999999);

    expect(dialog.entryOverTolerance()).toBe(true);
    dialog.addLine();
    expect(dialog.lines()).toEqual([]);
  });

  it('adds a line inside the over-ship tolerance without a reason', () => {
    const dialog = setup(null, [{ ...orderLine(1, 100, 'RS-1'), maxShippableQuantity: 110, overShipTolerancePct: 10 }]);
    dialog.shipmentForm.controls.salesOrderId.setValue(40);

    dialog.lineForm.controls.salesOrderLineId.setValue(1);
    dialog.lineForm.controls.quantity.setValue(108);
    dialog.addLine();

    expect(dialog.entryOverTolerance()).toBe(false);
    expect(dialog.lines()).toEqual([expect.objectContaining({ salesOrderLineId: 1, quantity: 108 })]);
    expect(dialog.lines()[0].overToleranceReason).toBeUndefined();
  });

  it('lets a manager add an over-tolerance line with a reason', () => {
    const dialog = setup(null, [{ ...orderLine(1, 100, 'RS-1'), maxShippableQuantity: 110, overShipTolerancePct: 10 }], ['Manager']);
    dialog.shipmentForm.controls.salesOrderId.setValue(40);

    dialog.lineForm.controls.salesOrderLineId.setValue(1);
    dialog.lineForm.controls.quantity.setValue(130);
    dialog.addLine();
    expect(dialog.lines()).toEqual([]);

    dialog.lineForm.controls.overReason.setValue('Customer took the overrun');
    dialog.addLine();

    expect(dialog.lines()).toEqual([expect.objectContaining({ quantity: 130, overToleranceReason: 'Customer took the overrun' })]);
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
