import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable, of, throwError } from 'rxjs';

import { OperationDialogComponent, OperationDialogData } from './operation-dialog.component';
import { PartsService } from '../../services/parts.service';
import { SchedulingService } from '../../../scheduling/services/scheduling.service';
import { Operation } from '../../models/operation.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface DialogInternals {
  formGroup: OperationDialogComponent['formGroup'];
  predecessorOptions(): { value: unknown; label: string }[];
  completeGateOptions(): { value: unknown; label: string }[];
  save(): void;
  dialogRef: { clearDraft(): void };
}

function op(id: number, stepNumber: number, overrides: Partial<Operation> = {}): Operation {
  return {
    id, partId: 3, stepNumber, title: `Step ${stepNumber}`, instructions: null, workCenterId: null, workCenterName: null,
    estimatedMs: null, setupMinutes: 0, runMinutesLot: 0, isQcCheckpoint: false, qcCriteria: null,
    referencedOperationId: null, referencedOperationTitle: null, materials: [], createdAt: new Date(), updatedAt: new Date(),
    isSubcontract: false, subcontractVendorId: null, subcontractVendorName: null, subcontractTurnTimeDays: null, scrapFactor: 0,
    ...overrides,
  };
}

const routing = [op(1, 10), op(2, 20), op(3, 30)];

function setup(data: OperationDialogData, update = vi.fn(() => of(op(3, 30))), confirm = true) {
  const partsService = {
    createOperation: vi.fn(() => of(op(4, 40))),
    updateOperation: update,
    getOperationFiles: vi.fn(() => of([])),
    getOperationActivity: vi.fn(() => of([])),
  };
  const dialogOpen = vi.fn(() => ({ afterClosed: () => of(confirm) }));
  const matDialogRef = { close: vi.fn() };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: matDialogRef },
      { provide: MatDialog, useValue: { open: dialogOpen } },
      { provide: PartsService, useValue: partsService },
      { provide: SchedulingService, useValue: { getWorkCenters: vi.fn(() => of([])) } },
      { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
    ],
  });
  const internals = TestBed.runInInjectionContext(() => new OperationDialogComponent()) as unknown as DialogInternals;
  internals.dialogRef = { clearDraft: vi.fn() };
  return { internals, partsService, dialogOpen, matDialogRef };
}

describe('OperationDialogComponent — must follow', () => {
  it('starts a new step on the previous step and sends no links for that default', () => {
    const { internals, partsService } = setup({ partId: 3, nextStepNumber: 40, operations: routing });

    expect(internals.formGroup.controls.predecessorIds.value).toEqual([3]);
    expect(internals.predecessorOptions().map(o => o.value)).toEqual([1, 2, 3]);
    internals.formGroup.patchValue({ title: 'Pack' });
    internals.save();

    expect(partsService.createOperation.mock.calls[0]).toBeDefined();
    const request = (partsService.createOperation.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
    expect(request['predecessors']).toBeUndefined();
    expect(request['cycleCountdown']).toBe(false);
  });

  it('sends parallel links with the Complete gate where asked', () => {
    const { internals, partsService } = setup({ partId: 3, nextStepNumber: 40, operations: routing });

    internals.formGroup.patchValue({ title: 'Pack', predecessorIds: [1, 2], completeGateIds: [2], cycleCountdown: true });
    expect(internals.completeGateOptions().map(o => o.value)).toEqual([1, 2]);
    internals.save();

    const request = (partsService.createOperation.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
    expect(request['predecessors']).toEqual([{ operationId: 1, gate: 'Quantity' }, { operationId: 2, gate: 'Complete' }]);
    expect(request['cycleCountdown']).toBe(true);
  });

  it('only offers lower step numbers and follows the step number while untouched', () => {
    const { internals } = setup({ partId: 3, operation: routing[1], operations: routing });

    expect(internals.predecessorOptions().map(o => o.value)).toEqual([1]);
    internals.formGroup.controls.stepNumber.setValue(35);

    expect(internals.predecessorOptions().map(o => o.value)).toEqual([1, 3]);
    expect(internals.formGroup.controls.predecessorIds.value).toEqual([3]);
  });

  it('clears explicit links back to the default with an empty list', () => {
    const update = vi.fn(() => of(op(3, 30)));
    const current = op(3, 30, { predecessors: [{ operationId: 1, stepNumber: 10, gate: 'Quantity' }] });
    const { internals } = setup({ partId: 3, operation: current, operations: [op(1, 10), op(2, 20), current] }, update);

    expect(internals.formGroup.controls.predecessorIds.value).toEqual([1]);
    internals.formGroup.patchValue({ predecessorIds: [2] });
    internals.save();

    expect((update.mock.calls[0] as unknown[])[2]).toMatchObject({ predecessors: [] });
  });

  it('asks before removing links a renumber breaks and saves again without them', () => {
    const update = vi.fn()
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({
        status: 409,
        error: { code: 'predecessor-conflict', conflicts: [{ operationId: 3, stepNumber: 30, predecessorOperationId: 2, predecessorStepNumber: 35 }] },
      })))
      .mockReturnValueOnce(of(op(2, 35)));
    const { internals, dialogOpen, matDialogRef } = setup({ partId: 3, operation: routing[1], operations: routing }, update);

    internals.formGroup.controls.stepNumber.setValue(35);
    internals.save();

    expect(dialogOpen).toHaveBeenCalledTimes(1);
    expect((update.mock.calls[1] as unknown[])[2]).toMatchObject({ stepNumber: 35, removeConflictingPredecessors: true });
    expect((update.mock.calls[1] as unknown[])[3]).toBe(true);
    expect(matDialogRef.close).toHaveBeenCalled();
  });
});
