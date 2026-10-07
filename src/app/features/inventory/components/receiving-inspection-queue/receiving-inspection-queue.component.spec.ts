import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { FormGroup } from '@angular/forms';

import { AuthService } from '../../../../shared/services/auth.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { InventoryService } from '../../services/inventory.service';
import { PendingInspectionItem } from '../../models/pending-inspection.model';
import { ReceivingInspectionQueueComponent } from './receiving-inspection-queue.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface QueueInternals {
  items(): PendingInspectionItem[];
  inspecting(): PendingInspectionItem | null;
  waiving(): PendingInspectionItem | null;
  canWaive(): boolean;
  inspectViolations(): string[];
  inspectForm: FormGroup;
  waiveForm: FormGroup;
  openInspect(item: PendingInspectionItem): void;
  submitInspect(): void;
  openWaive(item: PendingInspectionItem): void;
  submitWaive(): void;
}

const item: PendingInspectionItem = {
  receivingRecordId: 12,
  partNumber: 'PN-100',
  partDescription: 'Bracket',
  poNumber: 'PO-1001',
  vendorName: 'Supplier',
  receivedQuantity: 10,
  receivedAt: '2026-10-01T00:00:00Z',
  qcTemplateName: null,
  daysWaiting: 2,
};

function setup(roles: string[] = ['Admin']) {
  const inventory = {
    getPendingInspections: vi.fn(() => of([item])),
    recordInspectionResult: vi.fn(() => of(undefined)),
    waiveInspection: vi.fn(() => of(undefined)),
  };
  const snackbar = { success: vi.fn(), error: vi.fn() };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: InventoryService, useValue: inventory },
      { provide: SnackbarService, useValue: snackbar },
      { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new ReceivingInspectionQueueComponent());
  component.ngOnInit();
  return { internals: component as unknown as QueueInternals, inventory, snackbar };
}

describe('ReceivingInspectionQueueComponent', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('loads the pending queue on init', () => {
    const { internals, inventory } = setup();

    expect(inventory.getPendingInspections).toHaveBeenCalledTimes(1);
    expect(internals.items()).toEqual([item]);
  });

  it('defaults the accepted quantity to the received quantity with the NCR option off', () => {
    const { internals } = setup();

    internals.openInspect(item);

    expect(internals.inspectForm.getRawValue()).toEqual({
      result: 'Passed', acceptedQuantity: 10, rejectedQuantity: 0, notes: '', createNcrOnReject: false,
    });
    expect(internals.inspectForm.valid).toBe(true);
  });

  it('turns the NCR option on once anything is rejected', () => {
    const { internals } = setup();
    internals.openInspect(item);

    internals.inspectForm.patchValue({ result: 'PartialAccept' });
    internals.inspectForm.patchValue({ acceptedQuantity: 8, rejectedQuantity: 2 });

    expect(internals.inspectForm.get('createNcrOnReject')!.value).toBe(true);
    expect(internals.inspectForm.valid).toBe(true);
  });

  it('keeps the NCR option the user chose', () => {
    const { internals } = setup();
    internals.openInspect(item);
    const ncr = internals.inspectForm.get('createNcrOnReject')!;
    ncr.setValue(false);
    ncr.markAsDirty();

    internals.inspectForm.patchValue({ acceptedQuantity: 8, rejectedQuantity: 2 });

    expect(ncr.value).toBe(false);
  });

  it('fills all-rejected when the result is Failed', () => {
    const { internals } = setup();
    internals.openInspect(item);

    internals.inspectForm.patchValue({ result: 'Failed' });

    expect(internals.inspectForm.get('acceptedQuantity')!.value).toBe(0);
    expect(internals.inspectForm.get('rejectedQuantity')!.value).toBe(10);
    expect(internals.inspectForm.get('createNcrOnReject')!.value).toBe(true);
  });

  it('is invalid when the quantities do not add up to the received quantity', () => {
    const { internals } = setup();
    internals.openInspect(item);

    internals.inspectForm.patchValue({ acceptedQuantity: 8, rejectedQuantity: 1 });

    expect(internals.inspectForm.valid).toBe(false);
    expect(internals.inspectViolations()).toHaveLength(1);
  });

  it('is invalid for a partial accept with nothing rejected', () => {
    const { internals } = setup();
    internals.openInspect(item);

    internals.inspectForm.patchValue({ result: 'PartialAccept', acceptedQuantity: 10, rejectedQuantity: 0 });

    expect(internals.inspectForm.valid).toBe(false);
  });

  it('records the result, closes the dialog and reloads the queue', () => {
    const { internals, inventory, snackbar } = setup();
    internals.openInspect(item);
    internals.inspectForm.patchValue({ result: 'PartialAccept' });
    internals.inspectForm.patchValue({ acceptedQuantity: 8, rejectedQuantity: 2, notes: ' Burrs ' });

    internals.submitInspect();

    expect(inventory.recordInspectionResult).toHaveBeenCalledWith(12, {
      result: 'PartialAccept', acceptedQuantity: 8, rejectedQuantity: 2, notes: 'Burrs', createNcrOnReject: true,
    });
    expect(internals.inspecting()).toBeNull();
    expect(snackbar.success).toHaveBeenCalled();
    expect(inventory.getPendingInspections).toHaveBeenCalledTimes(2);
  });

  it('shows Waive only to Admin and Manager', () => {
    expect(setup(['Admin']).internals.canWaive()).toBe(true);
    expect(setup(['Manager']).internals.canWaive()).toBe(true);
    expect(setup(['Engineer']).internals.canWaive()).toBe(false);
  });

  it('requires a reason before waiving', () => {
    const { internals, inventory } = setup();
    internals.openWaive(item);

    internals.submitWaive();

    expect(internals.waiveForm.valid).toBe(false);
    expect(inventory.waiveInspection).not.toHaveBeenCalled();
  });

  it('waives with the trimmed reason and reloads the queue', () => {
    const { internals, inventory } = setup();
    internals.openWaive(item);
    internals.waiveForm.patchValue({ reason: '  Certified lot  ' });

    internals.submitWaive();

    expect(inventory.waiveInspection).toHaveBeenCalledWith(12, 'Certified lot');
    expect(internals.waiving()).toBeNull();
    expect(inventory.getPendingInspections).toHaveBeenCalledTimes(2);
  });
});
