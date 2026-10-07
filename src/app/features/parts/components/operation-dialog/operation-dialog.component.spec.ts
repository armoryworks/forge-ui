import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable, of } from 'rxjs';

import { OperationDialogComponent, OperationDialogData } from './operation-dialog.component';
import { PartsService } from '../../services/parts.service';
import { SchedulingService } from '../../../scheduling/services/scheduling.service';
import { Operation } from '../../models/operation.model';
import { CreateOperationRequest } from '../../models/create-operation-request.model';
import { UpdateOperationRequest } from '../../models/update-operation-request.model';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface DialogInternals {
  formGroup: OperationDialogComponent['formGroup'];
  save(): void;
  dialogRef: { clearDraft(): void };
}

function makeOperation(overrides: Partial<Operation> = {}): Operation {
  return {
    id: 7,
    partId: 3,
    stepNumber: 1,
    title: 'Mill',
    instructions: null,
    workCenterId: null,
    workCenterName: null,
    estimatedMs: null,
    setupMinutes: 0,
    runMinutesLot: 0,
    isQcCheckpoint: false,
    qcCriteria: null,
    referencedOperationId: null,
    referencedOperationTitle: null,
    materials: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    isSubcontract: false,
    subcontractVendorId: null,
    subcontractVendorName: null,
    subcontractTurnTimeDays: null,
    ...overrides,
  };
}

function setup(data: OperationDialogData) {
  const partsService = {
    createOperation: vi.fn((_partId: number, _req: CreateOperationRequest) => of(makeOperation())),
    updateOperation: vi.fn((_partId: number, _opId: number, _req: UpdateOperationRequest) => of(makeOperation())),
    getOperationFiles: vi.fn(() => of([])),
    getOperationActivity: vi.fn(() => of([])),
  };
  const matDialogRef = { close: vi.fn() };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: matDialogRef },
      { provide: MatDialog, useValue: { open: vi.fn() } },
      { provide: PartsService, useValue: partsService },
      { provide: SchedulingService, useValue: { getWorkCenters: vi.fn(() => of([])) } },
    ],
  });

  const component = TestBed.runInInjectionContext(() => new OperationDialogComponent());
  const internals = component as unknown as DialogInternals;
  internals.dialogRef = { clearDraft: vi.fn() };
  return { internals, partsService };
}

describe('OperationDialogComponent — estimated time, setup and per-lot fields', () => {
  it('composes 0h 0m 7.5s into 7500 ms on create', () => {
    const { internals, partsService } = setup({ partId: 3, nextStepNumber: 1 });
    internals.formGroup.patchValue({ title: 'Mill', estHours: 0, estMinutes: 0, estSeconds: 7.5 });

    internals.save();

    const request = partsService.createOperation.mock.calls[0][1];
    expect(request.estimatedMs).toBe(7500);
  });

  it('rounds fractional seconds to whole milliseconds', () => {
    const { internals, partsService } = setup({ partId: 3, nextStepNumber: 1 });
    internals.formGroup.patchValue({ title: 'Mill', estHours: 1, estMinutes: 2, estSeconds: 3.0004 });

    internals.save();

    expect(partsService.createOperation.mock.calls[0][1].estimatedMs).toBe(3_723_000);
  });

  it('decomposes a stored estimate into hours, minutes and fractional seconds', () => {
    const { internals } = setup({ partId: 3, operation: makeOperation({ estimatedMs: 3_727_500 }) });

    expect(internals.formGroup.controls.estHours.value).toBe(1);
    expect(internals.formGroup.controls.estMinutes.value).toBe(2);
    expect(internals.formGroup.controls.estSeconds.value).toBe(7.5);
  });

  it('reopens 7500 ms as 7.5 seconds', () => {
    const { internals } = setup({ partId: 3, operation: makeOperation({ estimatedMs: 7500 }) });

    expect(internals.formGroup.controls.estHours.value).toBe(0);
    expect(internals.formGroup.controls.estMinutes.value).toBe(0);
    expect(internals.formGroup.controls.estSeconds.value).toBe(7.5);
  });

  it('rejects seconds outside 0 to 59.999', () => {
    const { internals } = setup({ partId: 3, nextStepNumber: 1 });
    const seconds = internals.formGroup.controls.estSeconds;

    seconds.setValue(59.999);
    expect(seconds.valid).toBe(true);
    seconds.setValue(60);
    expect(seconds.hasError('max')).toBe(true);
    seconds.setValue(-1);
    expect(seconds.hasError('min')).toBe(true);
  });

  it('sends setup and per-lot minutes on create', () => {
    const { internals, partsService } = setup({ partId: 3, nextStepNumber: 1 });
    internals.formGroup.patchValue({ title: 'Mill', setupMinutes: 45, runMinutesLot: 12.5 });

    internals.save();

    const request = partsService.createOperation.mock.calls[0][1];
    expect(request.setupMinutes).toBe(45);
    expect(request.runMinutesLot).toBe(12.5);
  });

  it('seeds setup and per-lot minutes in edit mode and sends cleared values as zero', () => {
    const { internals, partsService } = setup({
      partId: 3,
      operation: makeOperation({ setupMinutes: 30, runMinutesLot: 5 }),
    });
    expect(internals.formGroup.controls.setupMinutes.value).toBe(30);
    expect(internals.formGroup.controls.runMinutesLot.value).toBe(5);

    internals.formGroup.patchValue({ setupMinutes: null, runMinutesLot: 8 });
    internals.save();

    const request = partsService.updateOperation.mock.calls[0][2];
    expect(request.setupMinutes).toBe(0);
    expect(request.runMinutesLot).toBe(8);
  });

  it('rejects negative setup and per-lot minutes', () => {
    const { internals } = setup({ partId: 3, nextStepNumber: 1 });

    internals.formGroup.controls.setupMinutes.setValue(-1);
    internals.formGroup.controls.runMinutesLot.setValue(-0.5);

    expect(internals.formGroup.controls.setupMinutes.hasError('min')).toBe(true);
    expect(internals.formGroup.controls.runMinutesLot.hasError('min')).toBe(true);
  });
});
