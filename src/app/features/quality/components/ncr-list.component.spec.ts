import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Signal } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { NcrListComponent } from './ncr-list.component';
import { NcrCapaService } from '../services/ncr-capa.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { NonConformance } from '../models/non-conformance.model';
import { NcrDispositionCode } from '../models/ncr-disposition-code.model';

interface DispositionView {
  dispositionForm: FormGroup<{
    code: FormControl<NcrDispositionCode>;
    notes: FormControl<string | null>;
    reworkInstructions: FormControl<string | null>;
  }>;
  notesRequired: Signal<boolean>;
  dispositionViolations: Signal<string[]>;
  detailRefresh: Signal<number>;
  openDisposition(ncr: NonConformance): void;
  saveDisposition(): void;
}

interface CreateView {
  createForm: FormGroup;
  createViolations: Signal<string[]>;
  selectedNcr: Signal<NonConformance | null>;
  openCreate(): void;
  saveNcr(): void;
  openDetail(row: unknown): void;
  closeDetail(): void;
}

describe('NcrListComponent disposition dialog', () => {
  let dispositionNcr: ReturnType<typeof vi.fn>;
  let view: DispositionView;

  beforeEach(() => {
    TestBed.resetTestingModule();
    dispositionNcr = vi.fn(() => of(undefined));
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: NcrCapaService, useValue: { dispositionNcr, getNcrs: vi.fn(() => of([])) } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
      ],
    });
    view = TestBed.runInInjectionContext(() => new NcrListComponent()) as unknown as DispositionView;
    view.openDisposition({ id: 5 } as NonConformance);
  });

  it('requires notes for the default Use As Is code and blocks the save', () => {
    expect(view.notesRequired()).toBe(true);
    expect(view.dispositionForm.invalid).toBe(true);
    expect(view.dispositionViolations()).toContain('ncrDetail.notes is required');

    view.saveDisposition();

    expect(dispositionNcr).not.toHaveBeenCalled();
  });

  it('treats whitespace-only notes as missing for Reject', () => {
    view.dispositionForm.controls.code.setValue('Reject');
    view.dispositionForm.controls.notes.setValue('   ');

    expect(view.dispositionForm.invalid).toBe(true);
  });

  it('does not require notes for Scrap', () => {
    view.dispositionForm.controls.code.setValue('Scrap');

    expect(view.notesRequired()).toBe(false);
    expect(view.dispositionForm.valid).toBe(true);
  });

  it('requires rework instructions only for Rework', () => {
    view.dispositionForm.controls.code.setValue('Rework');
    expect(view.dispositionViolations()).toEqual(['ncrDetail.reworkInstructions is required']);

    view.dispositionForm.controls.reworkInstructions.setValue('Re-machine the bore');
    expect(view.dispositionForm.valid).toBe(true);
  });

  it('sends the disposition once Use As Is has notes', () => {
    view.dispositionForm.controls.notes.setValue('Customer deviation approved');

    view.saveDisposition();

    expect(dispositionNcr).toHaveBeenCalledWith(5, expect.objectContaining({
      code: 'UseAsIs',
      notes: 'Customer deviation approved',
    }));
  });

  it('refreshes an open detail panel after recording a disposition', () => {
    view.dispositionForm.controls.code.setValue('Scrap');

    view.saveDisposition();

    expect(view.detailRefresh()).toBe(1);
  });
});

describe('NcrListComponent create dialog and detail panel', () => {
  let createNcr: ReturnType<typeof vi.fn>;
  let view: CreateView;

  beforeEach(() => {
    TestBed.resetTestingModule();
    createNcr = vi.fn(() => of({ id: 1 }));
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: NcrCapaService, useValue: { createNcr, getNcrs: vi.fn(() => of([])) } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
      ],
    });
    view = TestBed.runInInjectionContext(() => new NcrListComponent()) as unknown as CreateView;
    view.openCreate();
  });

  it('requires a picked part before the NCR can be raised', () => {
    view.createForm.patchValue({ description: 'Burr on edge', affectedQuantity: 4 });

    expect(view.createViolations()).toEqual(['ncrDetail.part is required']);
    view.saveNcr();
    expect(createNcr).not.toHaveBeenCalled();
  });

  it('sends the picked part, work order and trimmed lot', () => {
    view.createForm.patchValue({
      partId: 12, jobId: 34, lotNumber: '  LOT-7 ', description: 'Burr on edge', affectedQuantity: 4,
    });

    view.saveNcr();

    expect(createNcr).toHaveBeenCalledWith(expect.objectContaining({
      partId: 12, jobId: 34, lotNumber: 'LOT-7', detectedAtStage: 'Receiving',
    }));
  });

  it('sends no lot when the lot is left blank', () => {
    view.createForm.patchValue({ partId: 12, description: 'Burr on edge', affectedQuantity: 4 });

    view.saveNcr();

    expect(createNcr).toHaveBeenCalledWith(expect.objectContaining({ jobId: null, lotNumber: null }));
  });

  it('opens and closes the detail panel for a row', () => {
    view.openDetail({ id: 3, ncrNumber: 'NCR-0003' });
    expect(view.selectedNcr()?.id).toBe(3);

    view.closeDetail();
    expect(view.selectedNcr()).toBeNull();
  });
});
