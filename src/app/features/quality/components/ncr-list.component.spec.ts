import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Signal } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { provideTranslateService } from '@ngx-translate/core';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';

import { NcrListComponent } from './ncr-list.component';
import { NcrCapaService } from '../services/ncr-capa.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { DetailDialogService } from '../../../shared/services/detail-dialog.service';
import { NonConformance } from '../models/non-conformance.model';
import { NcrDispositionCode } from '../models/ncr-disposition-code.model';

type UrlDetail = { entityType: string; entityId: number } | null;

function routingProviders(detail: () => UrlDetail = () => null, navigate: unknown = vi.fn()) {
  const queryParams = new BehaviorSubject(convertToParamMap({}));
  return {
    queryParams,
    providers: [
      { provide: DetailDialogService, useValue: { getDetailFromUrl: detail } },
      { provide: ActivatedRoute, useValue: { queryParamMap: queryParams.asObservable() } },
      { provide: Router, useValue: { navigate } },
    ],
  };
}

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
        ...routingProviders().providers,
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
        ...routingProviders().providers,
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

describe('NcrListComponent ?detail= deep link', () => {
  let getNcr: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;
  let detail: UrlDetail;
  let routing: ReturnType<typeof routingProviders>;

  function create(): CreateView {
    TestBed.resetTestingModule();
    getNcr = vi.fn((id: number) => of({ id, ncrNumber: `NCR-${id}` } as NonConformance));
    navigate = vi.fn();
    routing = routingProviders(() => detail, navigate);
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: NcrCapaService, useValue: { getNcr, getNcrs: vi.fn(() => of([])) } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
        ...routing.providers,
      ],
    });
    return TestBed.runInInjectionContext(() => new NcrListComponent()) as unknown as CreateView;
  }

  beforeEach(() => {
    detail = null;
  });

  it('opens the detail panel for the NCR named in ?detail=ncr:{id}', () => {
    detail = { entityType: 'ncr', entityId: 41 };

    const view = create();

    expect(getNcr).toHaveBeenCalledWith(41);
    expect(view.selectedNcr()?.ncrNumber).toBe('NCR-41');
  });

  it('ignores a detail param for another entity type', () => {
    detail = { entityType: 'recall', entityId: 41 };

    const view = create();

    expect(getNcr).not.toHaveBeenCalled();
    expect(view.selectedNcr()).toBeNull();
  });

  it('opens a newly linked NCR when the query params change', () => {
    const view = create();
    expect(getNcr).not.toHaveBeenCalled();

    detail = { entityType: 'ncr', entityId: 7 };
    routing.queryParams.next(convertToParamMap({ detail: 'ncr:7' }));

    expect(view.selectedNcr()?.id).toBe(7);
  });

  it('clears the ncr detail param when the panel closes', () => {
    detail = { entityType: 'ncr', entityId: 41 };
    const view = create();

    view.closeDetail();

    expect(view.selectedNcr()).toBeNull();
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: { detail: null }, queryParamsHandling: 'merge', replaceUrl: true,
    }));
  });

  it('leaves the URL alone when closing a panel opened from a row', () => {
    const view = create();
    view.openDetail({ id: 3, ncrNumber: 'NCR-0003' });

    view.closeDetail();

    expect(navigate).not.toHaveBeenCalled();
  });
});
