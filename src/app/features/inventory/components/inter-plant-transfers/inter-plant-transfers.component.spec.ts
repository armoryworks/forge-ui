import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormArray, FormControl, FormGroup } from '@angular/forms';

import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../../../shared/services/auth.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { InterPlantTransferService } from '../../services/inter-plant-transfer.service';
import { InventoryService } from '../../services/inventory.service';
import { InterPlantTransfer } from '../../models/inter-plant-transfer.model';
import { PartBinLocation } from '../../models/part-bin-location.model';
import { TransferLineForm } from '../../models/transfer-line-form.model';
import { TransferReceiveLineForm } from '../../models/transfer-receive-line-form.model';
import { InterPlantTransfersComponent } from './inter-plant-transfers.component';

interface TransfersInternals {
  canManage: boolean;
  transfers(): InterPlantTransfer[];
  inTransit(): { transfers: number; quantity: number };
  canShip(t: InterPlantTransfer): boolean;
  canReceive(t: InterPlantTransfer): boolean;
  openCreate(): void;
  createForm: FormGroup<{ fromPlantId: FormControl<number | null>; toPlantId: FormControl<number | null>; notes: FormControl<string>; lines: FormArray<TransferLineForm> }>;
  lineGroups: TransferLineForm[];
  samePlant(): boolean;
  saveCreate(): void;
  openShip(t: InterPlantTransfer): void;
  trackingControl: FormControl<string>;
  confirmShip(): void;
  openReceive(t: InterPlantTransfer): void;
  receiveLines: FormArray<TransferReceiveLineForm>;
  confirmReceive(): void;
  cancel(t: InterPlantTransfer): void;
}

function transfer(overrides: Partial<InterPlantTransfer> = {}): InterPlantTransfer {
  return {
    id: 1, transferNumber: 'IPT-20261026-00001', fromPlantId: 1, fromPlantName: 'North', toPlantId: 2, toPlantName: 'South',
    status: 'Draft', shippedAt: null, receivedAt: null, trackingNumber: null, notes: null, lineCount: 1,
    lines: [{ id: 11, partId: 10, partNumber: 'BRK-10', partDescription: 'Bracket', quantity: 40, receivedQuantity: null, lotNumber: null, fromLocationId: 5, fromLocationPath: 'A1', toLocationId: 6, toLocationPath: 'S1' }],
    createdAt: '2026-10-26T00:00:00Z', updatedAt: '2026-10-26T00:00:00Z',
    ...overrides,
  };
}

const BINS: PartBinLocation[] = [
  { binContentId: 31, locationPath: 'Main / A1', quantity: 10, reservedQuantity: 0, availableQuantity: 10, lotNumber: 'H-1', status: 'Stored', locationId: 5 },
];

describe('InterPlantTransfersComponent', () => {
  let service: Record<string, ReturnType<typeof vi.fn>>;
  let dialogResult: boolean;

  function setup(roles: string[] = ['Manager'], list: InterPlantTransfer[] = [transfer()]) {
    service = {
      getTransfers: vi.fn(() => of(list)),
      getPlants: vi.fn(() => of([{ id: 1, code: 'N', name: 'North', isDefault: true }, { id: 2, code: 'S', name: 'South', isDefault: false }])),
      create: vi.fn(() => of(transfer())),
      ship: vi.fn(() => of(undefined)),
      receive: vi.fn(() => of(undefined)),
      cancel: vi.fn(() => of(undefined)),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: InterPlantTransferService, useValue: service },
        { provide: InventoryService, useValue: { getPartBins: vi.fn(() => of(BINS)) } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: SnackbarService, useValue: { success: vi.fn(), info: vi.fn() } },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(dialogResult) }) } },
        { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
      ],
    });
    return TestBed.runInInjectionContext(() => new InterPlantTransfersComponent()) as unknown as TransfersInternals;
  }

  beforeEach(() => { dialogResult = true; });

  it('loads transfers and counts what is in transit', () => {
    const c = setup(['Manager'], [transfer(), transfer({ id: 2, status: 'Shipped' })]);

    expect(service['getTransfers']).toHaveBeenCalledWith(null);
    expect(c.transfers().length).toBe(2);
    expect(c.inTransit()).toEqual({ transfers: 1, quantity: 40 });
  });

  it('offers ship and cancel before shipping, receive after, and nothing to a production worker', () => {
    const manager = setup();
    expect(manager.canShip(transfer())).toBe(true);
    expect(manager.canReceive(transfer())).toBe(false);
    expect(manager.canReceive(transfer({ status: 'Shipped' }))).toBe(true);

    const worker = setup(['ProductionWorker']);
    expect(worker.canManage).toBe(false);
    expect(worker.canShip(transfer())).toBe(false);
  });

  it('creates a transfer with the source bin and lot of each line', () => {
    const c = setup();
    c.openCreate();
    c.createForm.controls.toPlantId.setValue(2);
    const line = c.lineGroups[0];
    line.controls.partId.setValue(10);
    line.controls.sourceBinContentId.setValue(31);
    line.controls.toLocationId.setValue(6);
    line.controls.quantity.setValue(4);

    c.saveCreate();

    expect(service['create']).toHaveBeenCalledWith({
      fromPlantId: 1, toPlantId: 2, notes: null,
      lines: [{ partId: 10, quantity: 4, fromLocationId: 5, toLocationId: 6, lotNumber: 'H-1' }],
    });
  });

  it('refuses the same plant on both ends', () => {
    const c = setup();
    c.openCreate();
    c.createForm.controls.toPlantId.setValue(1);

    expect(c.samePlant()).toBe(true);
    c.saveCreate();
    expect(service['create']).not.toHaveBeenCalled();
  });

  it('ships with the tracking number and receives into a chosen bin', () => {
    const c = setup();
    c.openShip(transfer());
    c.trackingControl.setValue(' 1Z999 ');
    c.confirmShip();
    expect(service['ship']).toHaveBeenCalledWith(1, '1Z999');

    c.openReceive(transfer({ status: 'Shipped' }));
    c.receiveLines.at(0).controls.receivedQuantity.setValue(38);
    c.receiveLines.at(0).controls.toLocationId.setValue(9);
    c.confirmReceive();
    expect(service['receive']).toHaveBeenCalledWith(1, [{ lineId: 11, partId: 10, receivedQuantity: 38, toLocationId: 9 }]);
  });

  it('cancels only after confirmation', () => {
    const c = setup();
    dialogResult = false;
    c.cancel(transfer());
    expect(service['cancel']).not.toHaveBeenCalled();

    dialogResult = true;
    c.cancel(transfer());
    expect(service['cancel']).toHaveBeenCalledWith(1);
  });
});
