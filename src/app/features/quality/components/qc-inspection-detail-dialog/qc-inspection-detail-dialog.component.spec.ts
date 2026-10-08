import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Signal } from '@angular/core';
import { FormArray, FormGroup } from '@angular/forms';
import { of } from 'rxjs';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';

import { QcInspectionDetailDialogComponent } from './qc-inspection-detail-dialog.component';
import { QualityService } from '../../services/quality.service';
import { NcrCapaService } from '../../services/ncr-capa.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { QcInspectionDetail } from '../../models/qc-inspection-detail.model';
import { NonConformance } from '../../models/non-conformance.model';

interface DialogView {
  form: FormGroup<{ results: FormArray<FormGroup> }>;
  ncrForm: FormGroup;
  isComplete: Signal<boolean>;
  passViolations: Signal<string[]>;
  completeViolations: Signal<string[]>;
  linkedNcr: Signal<NonConformance | null>;
  showNcrForm: Signal<boolean>;
  markPassed(): void;
  markFailed(): void;
  save(): void;
  openNcrForm(): void;
  raiseNcr(): void;
  openNcr(): void;
}

function makeInspection(overrides: Partial<QcInspectionDetail> = {}): QcInspectionDetail {
  return {
    id: 12,
    jobId: 40,
    jobNumber: 'J-3600',
    jobTitle: 'Bracket run',
    partId: 7,
    partNumber: 'P-1001',
    partName: 'Bracket',
    productionRunId: null,
    productionRunNumber: null,
    templateId: 3,
    templateName: 'Dimensional',
    inspectorId: 1,
    inspectorName: 'Admin User',
    lotNumber: 'LOT-1',
    status: 'InProgress',
    notes: null,
    completedAt: null,
    createdAt: new Date('2026-10-01'),
    updatedAt: new Date('2026-10-01'),
    results: [
      { id: 100, checklistItemId: 1, description: 'Length', specification: '10 mm', isRequired: true, passed: false, measuredValue: null, notes: null },
      { id: 101, checklistItemId: 2, description: 'Finish', specification: null, isRequired: false, passed: false, measuredValue: null, notes: null },
    ],
    ...overrides,
  };
}

describe('QcInspectionDetailDialogComponent', () => {
  let getInspection: ReturnType<typeof vi.fn>;
  let updateInspection: ReturnType<typeof vi.fn>;
  let createNcr: ReturnType<typeof vi.fn>;
  let getNcrs: ReturnType<typeof vi.fn>;
  let close: ReturnType<typeof vi.fn>;

  function setup(inspection: QcInspectionDetail, ncrEnabled = true): DialogView {
    TestBed.resetTestingModule();
    getInspection = vi.fn(() => of(inspection));
    updateInspection = vi.fn(() => of({ id: inspection.id }));
    createNcr = vi.fn(() => of({ id: 55, ncrNumber: 'NCR-0055', qcInspectionId: inspection.id } as NonConformance));
    getNcrs = vi.fn(() => of([] as NonConformance[]));
    close = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: QualityService, useValue: { getInspection, updateInspection } },
        { provide: NcrCapaService, useValue: { createNcr, getNcrs } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: CapabilityService, useValue: { isEnabled: (code: string) => code === 'CAP-QC-NCR' && ncrEnabled } },
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: { inspectionId: inspection.id } },
      ],
    });
    return TestBed.runInInjectionContext(() => new QcInspectionDetailDialogComponent()) as unknown as DialogView;
  }

  describe('an inspection in progress', () => {
    let view: DialogView;

    beforeEach(() => {
      view = setup(makeInspection());
    });

    it('loads one editable row per result', () => {
      expect(getInspection).toHaveBeenCalledWith(12);
      expect(view.form.controls.results.length).toBe(2);
      expect(view.form.enabled).toBe(true);
      expect(view.isComplete()).toBe(false);
    });

    it('blocks Pass while a required check has not passed', () => {
      expect(view.passViolations().length).toBe(1);

      view.markPassed();

      expect(updateInspection).not.toHaveBeenCalled();
    });

    it('passes once the required check passes, sending every result', () => {
      view.form.controls.results.at(0).patchValue({ passed: true, measuredValue: ' 10.02 ' });
      expect(view.passViolations()).toEqual([]);

      view.markPassed();

      expect(updateInspection).toHaveBeenCalledWith(12, expect.objectContaining({
        status: 'Passed',
        results: [
          expect.objectContaining({ id: 100, checklistItemId: 1, passed: true, measuredValue: '10.02' }),
          expect.objectContaining({ id: 101, checklistItemId: 2, passed: false }),
        ],
      }));
    });

    it('saves results without a status', () => {
      view.save();

      const body = updateInspection.mock.calls[0][1] as Record<string, unknown>;
      expect(body['status']).toBeUndefined();
      expect((body['results'] as unknown[]).length).toBe(2);
    });

    it('fails the inspection even when required checks did not pass', () => {
      view.markFailed();

      expect(updateInspection).toHaveBeenCalledWith(12, expect.objectContaining({ status: 'Failed' }));
    });
  });

  describe('an inspection whose rows have not been checked', () => {
    let view: DialogView;

    beforeEach(() => {
      view = setup(makeInspection({
        results: [
          { id: 100, checklistItemId: 1, description: 'Length', specification: '10 mm', isRequired: true, passed: null, measuredValue: null, notes: null },
          { id: 101, checklistItemId: 2, description: 'Finish', specification: null, isRequired: false, passed: null, measuredValue: null, notes: null },
        ],
      }));
    });

    it('keeps the unchecked rows unset rather than reading them as failed', () => {
      expect(view.form.controls.results.getRawValue().map(r => r['passed'])).toEqual([null, null]);
      expect(view.completeViolations()).toEqual(['qcInspections.requiredNotChecked']);
      expect(view.passViolations()).toEqual(['qcInspections.requiredNotChecked']);
    });

    it('blocks both Pass and Fail until every required row is checked', () => {
      view.markPassed();
      view.markFailed();

      expect(updateInspection).not.toHaveBeenCalled();
    });

    it('saves with the unchecked rows still unset', () => {
      view.save();

      expect(updateInspection).toHaveBeenCalledWith(12, expect.objectContaining({
        results: [
          expect.objectContaining({ id: 100, passed: null }),
          expect.objectContaining({ id: 101, passed: null }),
        ],
      }));
    });

    it('fails once the required row is checked, leaving the optional row unset', () => {
      view.form.controls.results.at(0).patchValue({ passed: false });
      expect(view.completeViolations()).toEqual([]);

      view.markFailed();

      expect(updateInspection).toHaveBeenCalledWith(12, expect.objectContaining({
        status: 'Failed',
        results: [
          expect.objectContaining({ id: 100, passed: false }),
          expect.objectContaining({ id: 101, passed: null }),
        ],
      }));
    });
  });

  describe('a failed inspection', () => {
    let view: DialogView;

    beforeEach(() => {
      view = setup(makeInspection({ status: 'Failed', completedAt: new Date('2026-10-02') }));
    });

    it('is read-only and looks for an NCR already raised from it', () => {
      expect(view.isComplete()).toBe(true);
      expect(view.form.disabled).toBe(true);
      expect(getNcrs).toHaveBeenCalledWith({ jobId: 40 });
      expect(view.linkedNcr()).toBeNull();
    });

    it('does not save changes', () => {
      view.save();
      view.markFailed();

      expect(updateInspection).not.toHaveBeenCalled();
    });

    it('raises an NCR with the work order, part, lot and inspection prefilled, then links to it', () => {
      view.openNcrForm();
      expect(view.showNcrForm()).toBe(true);
      expect(view.ncrForm.getRawValue()).toEqual(expect.objectContaining({ partId: 7, affectedQuantity: 1 }));

      view.raiseNcr();

      expect(createNcr).toHaveBeenCalledWith(expect.objectContaining({
        type: 'Internal',
        partId: 7,
        jobId: 40,
        lotNumber: 'LOT-1',
        qcInspectionId: 12,
      }));
      expect(view.linkedNcr()?.ncrNumber).toBe('NCR-0055');
      expect(view.showNcrForm()).toBe(false);

      view.openNcr();

      expect(close).toHaveBeenCalledWith({ changed: true, openNcrId: 55 });
    });

    it('requires a part before raising an NCR for an inspection without one', () => {
      view = setup(makeInspection({ status: 'Failed', partId: null, partNumber: null }));
      view.openNcrForm();

      expect(view.ncrForm.invalid).toBe(true);
      view.raiseNcr();

      expect(createNcr).not.toHaveBeenCalled();
    });

    it('skips the linked-NCR lookup when it has neither a work order nor a part', () => {
      view = setup(makeInspection({ status: 'Failed', jobId: null, partId: null, partNumber: null }));

      expect(getNcrs).not.toHaveBeenCalled();
    });

    it('offers no NCR when NCRs are turned off', () => {
      view = setup(makeInspection({ status: 'Failed' }), false);

      expect(getNcrs).not.toHaveBeenCalled();
      view.openNcrForm();
      expect(view.showNcrForm()).toBe(false);
      view.raiseNcr();
      expect(createNcr).not.toHaveBeenCalled();
    });
  });

  it('shows the NCR already raised from a failed inspection', () => {
    TestBed.resetTestingModule();
    const inspection = makeInspection({ status: 'Failed', jobId: null });
    const ncrs = [
      { id: 8, ncrNumber: 'NCR-0008', qcInspectionId: 99 },
      { id: 9, ncrNumber: 'NCR-0009', qcInspectionId: 12 },
    ] as NonConformance[];
    TestBed.configureTestingModule({
      providers: [
        { provide: QualityService, useValue: { getInspection: vi.fn(() => of(inspection)) } },
        { provide: NcrCapaService, useValue: { getNcrs: vi.fn(() => of(ncrs)) } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: CapabilityService, useValue: { isEnabled: () => true } },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: MAT_DIALOG_DATA, useValue: { inspectionId: 12 } },
      ],
    });
    const view = TestBed.runInInjectionContext(() => new QcInspectionDetailDialogComponent()) as unknown as DialogView;

    expect(view.linkedNcr()?.ncrNumber).toBe('NCR-0009');
  });
});
