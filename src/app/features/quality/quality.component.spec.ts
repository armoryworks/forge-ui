import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Signal, signal } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BehaviorSubject, of, Subject } from 'rxjs';

import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';

import { QualityComponent } from './quality.component';
import { QualityService } from './services/quality.service';
import { KanbanService } from '../kanban/services/kanban.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { ScannerService } from '../../shared/services/scanner.service';
import { DetailDialogService } from '../../shared/services/detail-dialog.service';
import { AuthService } from '../../shared/services/auth.service';
import { SelectOption } from '../../shared/components/select/select.component';
import { QcTemplate } from './models/qc-template.model';

interface QualityView {
  inspectionForm: FormGroup<{
    jobId: FormControl<number | null>;
    partId: FormControl<number | null>;
    templateId: FormControl<number | null>;
    lotNumber: FormControl<string>;
    notes: FormControl<string>;
  }>;
  inspectionSearchControl: FormControl<string>;
  templateOptions: Signal<SelectOption[]>;
  templateColumns: Signal<{ field: string }[]>;
  openCreateInspection(): void;
  editTemplate(row: unknown): void;
  lotSuggestions: Signal<string[]>;
  onWorkOrderSelected(job: Record<string, unknown> | null): void;
  saveInspection(): void;
  openInspection(row: unknown): void;
}

interface SetupOptions {
  roles?: string[];
  lastScan?: { value: string; context: string } | null;
}

function setup(tab: string, queryParams: Record<string, string> = {}, options: SetupOptions = {}) {
  const roles = options.roles ?? ['Admin'];
  TestBed.resetTestingModule();
  const getInspections = vi.fn(() => of([]));
  const getTemplates = vi.fn(() => of([{ id: 3, name: 'Dimensional', items: [] } as unknown as QcTemplate]));
  const getLotRecords = vi.fn(() => of([
    { lotNumber: 'LOT-A1' }, { lotNumber: 'LOT-B2' }, { lotNumber: 'LOT-A1' },
  ]));
  const createInspection = vi.fn(() => of({ id: 1 }));
  const getJobDetail = vi.fn(() => of({ id: 40, partId: 7, partNumber: 'P-1001' }));
  const navigate = vi.fn(() => Promise.resolve(true));
  const afterClosed = new Subject<unknown>();
  const open = vi.fn(() => ({ afterClosed: () => afterClosed }));
  const detailClosed = new Subject<unknown>();
  const openDetail = vi.fn(() => ({ afterClosed: () => detailClosed }));
  const clearLastScan = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: QualityService, useValue: { getInspections, getTemplates, getLotRecords, createInspection } },
      { provide: KanbanService, useValue: { getJobDetail } },
      { provide: SnackbarService, useValue: { success: vi.fn() } },
      { provide: ScannerService, useValue: { setContext: vi.fn(), lastScan: signal(options.lastScan ?? null), clearLastScan } },
      { provide: DetailDialogService, useValue: { getDetailFromUrl: () => null, open: openDetail } },
      { provide: AuthService, useValue: { hasAnyRole: (allowed: string[]) => allowed.some(r => roles.includes(r)) } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
      { provide: MatDialog, useValue: { open } },
      { provide: Router, useValue: { navigate } },
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: new BehaviorSubject(convertToParamMap({ tab })),
          snapshot: { queryParamMap: convertToParamMap(queryParams) },
        },
      },
    ],
  });
  const view = TestBed.runInInjectionContext(() => new QualityComponent()) as unknown as QualityView;
  TestBed.tick();
  return { view, getInspections, getTemplates, getLotRecords, createInspection, getJobDetail, navigate, open, afterClosed, detailClosed, clearLastScan };
}

describe('QualityComponent', () => {
  it('sends the Lot Tracking tab to the single lot list', () => {
    const { navigate, getInspections } = setup('lots');

    expect(navigate).toHaveBeenCalledWith(['/lots'], { replaceUrl: true });
    expect(getInspections).not.toHaveBeenCalled();
  });

  it('loads inspections with the search and status from the URL', () => {
    const { getInspections } = setup('inspections', { q: 'J-3600', status: 'Failed' });

    expect(getInspections).toHaveBeenCalledWith({ status: 'Failed', search: 'J-3600' });
  });

  it('prefills the part from the picked work order and suggests its lots', () => {
    const { view, getJobDetail, getLotRecords } = setup('inspections');

    view.inspectionForm.controls.jobId.setValue(40);
    view.onWorkOrderSelected({ id: 40, jobNumber: 'J-3600' });

    expect(getJobDetail).toHaveBeenCalledWith(40);
    expect(view.inspectionForm.controls.partId.value).toBe(7);
    expect(getLotRecords).toHaveBeenCalledWith({ partId: 7 });
    expect(view.lotSuggestions()).toEqual(['LOT-A1', 'LOT-B2']);

    view.inspectionForm.controls.lotNumber.setValue('b2');
    expect(view.lotSuggestions()).toEqual(['LOT-B2']);
  });

  it('sends no work order when none was picked', () => {
    const { view, createInspection } = setup('inspections');
    view.inspectionForm.patchValue({ partId: 7, templateId: 3, lotNumber: ' LOT-9 ' });

    view.saveInspection();

    expect(createInspection).toHaveBeenCalledWith({
      jobId: undefined,
      partId: 7,
      templateId: 3,
      lotNumber: 'LOT-9',
      notes: undefined,
    });
  });

  it('offers a new template from the template select and selects it once saved', () => {
    const { view, open, afterClosed } = setup('inspections');
    const newOption = view.templateOptions().at(-1)!;
    expect(newOption.label).toBe('qcInspections.newTemplateOption');

    view.inspectionForm.controls.templateId.setValue(newOption.value as number);
    expect(open).toHaveBeenCalledTimes(1);

    afterClosed.next({ id: 11, name: 'Visual', items: [] });

    expect(view.inspectionForm.controls.templateId.value).toBe(11);
  });

  it('clears the template choice when the new template is cancelled', () => {
    const { view, afterClosed } = setup('inspections');
    view.inspectionForm.controls.templateId.setValue(view.templateOptions().at(-1)!.value as number);

    afterClosed.next(undefined);

    expect(view.inspectionForm.controls.templateId.value).toBeNull();
  });

  it('hides template authoring from roles the API does not allow to author', () => {
    const { view, open } = setup('templates', {}, { roles: ['Engineer'] });

    expect(view.templateOptions().some(o => o.value === -1)).toBe(false);
    expect(view.templateColumns().some(c => c.field === 'actions')).toBe(false);

    view.editTemplate({ id: 3 });
    expect(open).not.toHaveBeenCalled();
  });

  it('loads templates once on the Templates tab and again when a new inspection opens', () => {
    const { view, getTemplates } = setup('templates');
    expect(getTemplates).toHaveBeenCalledTimes(1);

    view.openCreateInspection();
    expect(getTemplates).toHaveBeenCalledTimes(2);
  });

  it('puts a scan into the inspection search only on the Inspections tab', () => {
    const onInspections = setup('inspections', {}, { lastScan: { value: 'LOT-9', context: 'quality' } });
    expect(onInspections.view.inspectionSearchControl.value).toBe('LOT-9');

    const onNcrs = setup('ncrs', {}, { lastScan: { value: 'LOT-9', context: 'quality' } });
    expect(onNcrs.clearLastScan).toHaveBeenCalled();
    expect(onNcrs.view.inspectionSearchControl.value).toBe('');
  });

  it('reloads inspections when the detail dialog closes without a result', () => {
    const { view, getInspections, detailClosed } = setup('inspections');
    const before = getInspections.mock.calls.length;

    view.openInspection({ id: 12 });
    detailClosed.next(undefined);

    expect(getInspections.mock.calls.length).toBe(before + 1);
  });
});
