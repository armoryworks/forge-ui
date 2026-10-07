import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { PurchaseOrderService } from '../../services/purchase-order.service';
import { InventoryService } from '../../../inventory/services/inventory.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { PurchaseOrderDetail } from '../../models/purchase-order-detail.model';
import { PurchaseOrderLine } from '../../models/purchase-order-line.model';
import { ReceiveItemsRequest } from '../../models/receive-items-request.model';
import { SelectOption } from '../../../../shared/components/select/select.component';
import { ReceiveDialogComponent } from './receive-dialog.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface DialogInternals {
  purchaseOrder: () => PurchaseOrderDetail;
  dialogRef: { clearDraft: () => void };
  lineControls(): FormControl<number>[];
  binControls(): FormControl<number | null>[];
  lotControls(): FormControl<string>[];
  noteControls(): FormControl<string>[];
  binOptions(): SelectOption[];
  isNoteOpen(lineId: number): boolean;
  toggleNote(lineId: number): void;
  save(): void;
  ngOnInit(): void;
}

function line(overrides: Partial<PurchaseOrderLine>): PurchaseOrderLine {
  return {
    id: 1,
    partId: 10,
    partNumber: 'BAR-1',
    description: 'Bar stock',
    orderedQuantity: 5,
    receivedQuantity: 0,
    remainingQuantity: 5,
    unbilledReceivedQuantity: 0,
    cancelledShortCloseQuantity: 0,
    unitPrice: 10,
    lineTotal: 50,
    notes: null,
    purchaseUnitId: null,
    purchaseUnitLabel: null,
    manualOverrideReason: null,
    partDefaultBinId: null,
    ...overrides,
  };
}

function setup(lines: PurchaseOrderLine[]) {
  const receiveItems = vi.fn((_id: number, _req: ReceiveItemsRequest) => of(undefined));
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: PurchaseOrderService, useValue: { receiveItems } },
      {
        provide: InventoryService,
        useValue: {
          getBinLocations: () => of([
            { id: 7, name: 'A-1', locationType: 'Bin', barcode: null, locationPath: 'Rack A / A-1' },
            { id: 9, name: 'B-2', locationType: 'Bin', barcode: null, locationPath: '' },
          ]),
        },
      },
      { provide: SnackbarService, useValue: { success: vi.fn() } },
    ],
  });

  const component = TestBed.runInInjectionContext(() => new ReceiveDialogComponent());
  const internals = component as unknown as DialogInternals;
  const po = { id: 100, poNumber: 'PO-100', estimatedFreight: null, lines } as unknown as PurchaseOrderDetail;
  internals.purchaseOrder = () => po;
  internals.dialogRef = { clearDraft: vi.fn() };
  internals.ngOnInit();
  return { internals, receiveItems };
}

describe('ReceiveDialogComponent — bin, lot and note per line', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('defaults each line bin to the part default bin and lists bins by path', () => {
    const { internals } = setup([
      line({ id: 1, partDefaultBinId: 7 }),
      line({ id: 2, partDefaultBinId: null }),
    ]);

    expect(internals.binControls().map(c => c.value)).toEqual([7, null]);
    expect(internals.binOptions()).toEqual([
      { value: 7, label: 'Rack A / A-1' },
      { value: 9, label: 'B-2' },
    ]);
  });

  it('sends the chosen bin, trimmed lot and note for lines being received', () => {
    const { internals, receiveItems } = setup([
      line({ id: 1, partDefaultBinId: 7 }),
      line({ id: 2 }),
    ]);

    internals.lineControls()[0].setValue(2);
    internals.binControls()[0].setValue(9);
    internals.lotControls()[0].setValue('  HT-4471 ');
    internals.noteControls()[0].setValue(' cert in folder ');
    internals.lotControls()[1].setValue('ignored');
    internals.save();

    expect(receiveItems).toHaveBeenCalledTimes(1);
    const request = receiveItems.mock.calls[0][1];
    expect(request.lines).toEqual([
      { lineId: 1, quantity: 2, storageLocationId: 9, lotNumber: 'HT-4471', notes: 'cert in folder' },
    ]);
  });

  it('leaves bin and lot unset when nothing was chosen so the server picks the bin', () => {
    const { internals, receiveItems } = setup([line({ id: 1 })]);

    internals.lineControls()[0].setValue(3);
    internals.save();

    expect(receiveItems.mock.calls[0][1].lines).toEqual([
      { lineId: 1, quantity: 3, storageLocationId: undefined, lotNumber: undefined, notes: undefined },
    ]);
  });

  it('keeps the line note collapsed until its toggle is used', () => {
    const { internals } = setup([line({ id: 1 }), line({ id: 2 })]);

    expect(internals.isNoteOpen(1)).toBe(false);
    internals.toggleNote(1);
    expect(internals.isNoteOpen(1)).toBe(true);
    expect(internals.isNoteOpen(2)).toBe(false);
    internals.toggleNote(1);
    expect(internals.isNoteOpen(1)).toBe(false);
  });

  it('does not submit when a lot number is longer than the column allows', () => {
    const { internals, receiveItems } = setup([line({ id: 1 })]);

    internals.lineControls()[0].setValue(1);
    internals.lotControls()[0].setValue('x'.repeat(101));
    internals.save();

    expect(receiveItems).not.toHaveBeenCalled();
  });
});
