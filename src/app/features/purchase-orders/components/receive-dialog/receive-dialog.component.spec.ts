import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { PurchaseOrderService } from '../../services/purchase-order.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { PurchaseOrderDetail } from '../../models/purchase-order-detail.model';
import { PurchaseOrderLine } from '../../models/purchase-order-line.model';
import { ReceiveItemsRequest } from '../../models/receive-items-request.model';
import { DraftConfig } from '../../../../shared/models/draft-config.model';
import { ReceiveDialogComponent } from './receive-dialog.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface DialogInternals {
  purchaseOrder: () => PurchaseOrderDetail;
  dialogRef: { clearDraft: () => void };
  lineControls(): FormControl<number>[];
  binControls(): FormControl<number | null>[];
  binLabels(): (string | null)[];
  binPickerFilters: Record<string, string>;
  binPickers: () => { setSelected: (id: number, label: string) => void }[];
  draftConfig: DraftConfig;
  lotControls(): FormControl<string>[];
  noteControls(): FormControl<string>[];
  onBinSelected(index: number, entity: Record<string, unknown> | null): void;
  ngAfterViewInit(): void;
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
    partDefaultBinPath: null,
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

  it('defaults each stocked line bin to the part default bin with its path', () => {
    const { internals } = setup([
      line({ id: 1, partDefaultBinId: 7, partDefaultBinPath: 'Rack A / A-1' }),
      line({ id: 2, partDefaultBinId: null }),
    ]);

    expect(internals.binControls().map(c => c.value)).toEqual([7, null]);
    expect(internals.binLabels()).toEqual(['Rack A / A-1', null]);
  });

  it('searches active bins only so an inactive bin cannot be picked', () => {
    const { internals } = setup([line({ id: 1 })]);

    expect(internals.binPickerFilters).toEqual({ activeOnly: 'true' });
  });

  it('shows the preselected default bin in the picker of each stocked line', () => {
    const { internals } = setup([
      line({ id: 1, partId: null as unknown as number, partDefaultBinId: null }),
      line({ id: 2, partDefaultBinId: 7, partDefaultBinPath: 'Rack A / A-1' }),
      line({ id: 3, partDefaultBinId: null }),
    ]);
    const first = { setSelected: vi.fn() };
    const second = { setSelected: vi.fn() };
    internals.binPickers = () => [first, second];

    internals.ngAfterViewInit();

    expect(first.setSelected).toHaveBeenCalledWith(7, 'Rack A / A-1');
    expect(second.setSelected).not.toHaveBeenCalled();
  });

  it('falls back to automatic placement once the picked bin is cleared', () => {
    const { internals, receiveItems } = setup([line({ id: 1, partDefaultBinId: 7, partDefaultBinPath: 'Rack A / A-1' })]);

    internals.lineControls()[0].setValue(1);
    internals.binControls()[0].setValue(null);
    internals.onBinSelected(0, null);
    internals.save();

    expect(internals.binLabels()).toEqual([null]);
    expect(receiveItems.mock.calls[0][1].lines[0].storageLocationId).toBeUndefined();
  });

  it('sends no bin or lot for a line without a part', () => {
    const { internals, receiveItems } = setup([
      line({ id: 1, partId: null as unknown as number, partDefaultBinId: 7 }),
    ]);

    internals.lineControls()[0].setValue(1);
    internals.binControls()[0].setValue(7);
    internals.lotControls()[0].setValue('HT-1');
    internals.save();

    expect(receiveItems.mock.calls[0][1].lines).toEqual([
      { lineId: 1, quantity: 1, storageLocationId: undefined, lotNumber: undefined, notes: undefined },
    ]);
  });

  it('restores the drafted bin with its label, including a cleared bin', () => {
    const { internals } = setup([
      line({ id: 1, partDefaultBinId: 7, partDefaultBinPath: 'Rack A / A-1' }),
      line({ id: 2 }),
    ]);

    internals.draftConfig.restoreFn!({
      'bin:1': null, 'binLabel:1': 'Rack A / A-1',
      'bin:2': 9, 'binLabel:2': 'Rack B / B-2',
    });

    expect(internals.binControls().map(c => c.value)).toEqual([null, 9]);
    expect(internals.binLabels()).toEqual([null, 'Rack B / B-2']);
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
