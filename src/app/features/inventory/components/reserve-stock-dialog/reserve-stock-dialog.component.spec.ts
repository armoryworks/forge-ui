import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';

import { of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { InventoryService } from '../../services/inventory.service';
import { PartBinLocation } from '../../models/part-bin-location.model';
import { ReservableSalesOrderLine } from '../../models/reservable-sales-order-line.model';
import { ReservationDemand } from '../../models/reservation-demand.type';
import { ReserveStockDialogComponent } from './reserve-stock-dialog.component';

interface DialogInternals {
  ngOnInit(): void;
  form: FormGroup<{
    partId: FormControl<number | null>;
    binContentId: FormControl<number | null>;
    demand: FormControl<ReservationDemand>;
    jobId: FormControl<number | null>;
    salesOrderLineId: FormControl<number | null>;
    quantity: FormControl<number | null>;
    notes: FormControl<string>;
  }>;
  binOptions(): { value: unknown; label: string }[];
  salesOrderLineOptions(): { value: unknown; label: string }[];
  noBins(): boolean;
  partLocked(): boolean;
  submit(): void;
  saved: { subscribe(fn: (value: unknown) => void): void };
}

const BINS: PartBinLocation[] = [
  { binContentId: 31, locationPath: 'Main / A1', quantity: 10, reservedQuantity: 4, availableQuantity: 6, lotNumber: 'HEAT-A', status: 'Stored', locationId: 5 },
  { binContentId: 33, locationPath: 'QC / Q1', quantity: 2, reservedQuantity: 0, availableQuantity: 2, lotNumber: null, status: 'QcHold', locationId: 6 },
];
const LINES: ReservableSalesOrderLine[] = [
  { salesOrderLineId: 70, salesOrderId: 7, salesOrderNumber: 'SO-1001', lineNumber: 1, customerName: 'Buyer Co', openQuantity: 20, reservedQuantity: 8, requestedDeliveryDate: null },
];

describe('ReserveStockDialogComponent', () => {
  let getPartBins: ReturnType<typeof vi.fn>;
  let getReservableSalesOrderLines: ReturnType<typeof vi.fn>;
  let createReservation: ReturnType<typeof vi.fn>;

  function setup(inputs: { partId?: number | null; salesOrderId?: number | null; salesOrderLineId?: number | null; quantity?: number | null } = {}) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: InventoryService, useValue: { getPartBins, getReservableSalesOrderLines, createReservation } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new ReserveStockDialogComponent());
    mockSignalInputs(component, {
      partId: inputs.partId ?? null, partLabel: 'P-10 · Bracket', salesOrderId: inputs.salesOrderId ?? null,
      salesOrderLineId: inputs.salesOrderLineId ?? null, quantity: inputs.quantity ?? null,
    });
    const dialog = component as unknown as DialogInternals;
    dialog.ngOnInit();
    return dialog;
  }

  beforeEach(() => {
    getPartBins = vi.fn(() => of(BINS));
    getReservableSalesOrderLines = vi.fn(() => of(LINES));
    createReservation = vi.fn(() => of({ id: 1 }));
  });

  it('offers only free, stored bins of the picked part and its open sales order lines', () => {
    const dialog = setup();

    dialog.form.controls.partId.setValue(10);

    expect(getPartBins).toHaveBeenCalledWith(10);
    expect(getReservableSalesOrderLines).toHaveBeenCalledWith(10, undefined);
    expect(dialog.binOptions().map(o => o.value)).toEqual([31]);
    expect(dialog.salesOrderLineOptions().map(o => o.value)).toEqual([70]);
  });

  it('shows the no-stock hint when every bin is held', () => {
    getPartBins = vi.fn(() => of([BINS[1]]));
    const dialog = setup();

    dialog.form.controls.partId.setValue(10);

    expect(dialog.noBins()).toBe(true);
  });

  it('opens from a sales order line with the part, the line and the open quantity filled in', () => {
    const dialog = setup({ partId: 10, salesOrderId: 7, salesOrderLineId: 70, quantity: 12 });

    expect(dialog.partLocked()).toBe(true);
    expect(getReservableSalesOrderLines).toHaveBeenCalledWith(10, 7);
    expect(dialog.form.controls.demand.value).toBe('salesOrderLine');
    expect(dialog.form.controls.salesOrderLineId.value).toBe(70);
    expect(dialog.form.controls.quantity.value).toBe(12);
  });

  it('requires a line when reserving for a sales order line and sends it', () => {
    const dialog = setup();
    dialog.form.patchValue({ partId: 10 });
    dialog.form.patchValue({ binContentId: 31, quantity: 5, demand: 'salesOrderLine' });

    expect(dialog.form.invalid).toBe(true);
    dialog.form.controls.salesOrderLineId.setValue(70);
    dialog.submit();

    expect(createReservation).toHaveBeenCalledWith({
      partId: 10, binContentId: 31, jobId: undefined, salesOrderLineId: 70, quantity: 5, notes: undefined,
    });
  });

  it('sends the job and no line when reserving for a job', () => {
    const dialog = setup();
    dialog.form.patchValue({ partId: 10 });
    dialog.form.patchValue({ binContentId: 31, quantity: 2, demand: 'job', jobId: 44 });

    dialog.submit();

    expect(createReservation).toHaveBeenCalledWith(expect.objectContaining({ jobId: 44, salesOrderLineId: undefined }));
  });
});
