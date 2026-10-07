import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Observable, of } from 'rxjs';

import { provideTranslateService, TranslateLoader, TranslateService } from '@ngx-translate/core';

import { DisposeJobDialogComponent, DisposeJobDialogData } from './dispose-job-dialog.component';
import { KanbanService } from '../services/kanban.service';
import { InventoryService } from '../../inventory/services/inventory.service';
import { PartsService } from '../../parts/services/parts.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

describe('DisposeJobDialogComponent', () => {
  const disposeJob = vi.fn();
  const getBinLocations = vi.fn();
  const getPartById = vi.fn();
  const success = vi.fn();
  const close = vi.fn();

  function create(data: Partial<DisposeJobDialogData> = {}): DisposeJobDialogComponent {
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: MAT_DIALOG_DATA, useValue: { jobId: 7, jobNumber: 'JOB-0007', partId: 3, currentDisposition: null, ...data } },
        { provide: MatDialogRef, useValue: { close } },
        { provide: KanbanService, useValue: { disposeJob } },
        { provide: InventoryService, useValue: { getBinLocations } },
        { provide: PartsService, useValue: { getPartById } },
        { provide: SnackbarService, useValue: { success } },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new DisposeJobDialogComponent());
    (component as unknown as { dialogRef: { clearDraft: () => void } }).dialogRef = { clearDraft: vi.fn() };
    return component;
  }

  function optionValues(component: DisposeJobDialogComponent): unknown[] {
    return component.dispositionOptions.map(o => o.value);
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllMocks();
    disposeJob.mockReturnValue(of({ id: 7 }));
    getBinLocations.mockReturnValue(of([
      { id: 1, name: 'A-01', locationType: 'Bin', barcode: null, locationPath: 'Main / A-01' },
      { id: 3, name: 'A-03', locationType: 'Bin', barcode: null, locationPath: 'Main / A-03' },
    ]));
    getPartById.mockReturnValue(of({ id: 3, defaultBinId: 3 }));
  });

  it('offers Entered in error and Other', () => {
    const component = create();

    expect(optionValues(component)).toContain('EnteredInError');
    expect(optionValues(component)).toContain('Other');
    expect(optionValues(component)).toContain('HoldForReview');
  });

  it('leaves Hold for review out when the job is already on hold', () => {
    const component = create({ currentDisposition: 'HoldForReview' });

    expect(optionValues(component)).not.toContain('HoldForReview');
    expect(optionValues(component)).toContain('Scrap');
  });

  it.each(['Scrap', 'HoldForReview', 'EnteredInError'] as const)('requires a reason for %s', disposition => {
    const component = create();
    component.formGroup.controls.disposition.setValue(disposition);

    expect(component.formGroup.controls.notes.hasError('required')).toBe(true);

    component.formGroup.controls.disposition.setValue('ShipToCustomer');

    expect(component.formGroup.controls.notes.hasError('required')).toBe(false);
  });

  it('asks for a good quantity and defaults the bin to the part default bin', () => {
    const component = create();
    component.formGroup.controls.disposition.setValue('AddToInventory');

    expect(getPartById).toHaveBeenCalledWith(3);
    expect(component.formGroup.controls.locationId.value).toBe(3);
    expect(component.formGroup.controls.goodQuantity.hasError('required')).toBe(true);

    component.formGroup.controls.goodQuantity.setValue(500);
    component.save();

    expect(disposeJob).toHaveBeenCalledWith(7, {
      disposition: 'AddToInventory',
      notes: undefined,
      goodQuantity: 500,
      locationId: 3,
    });
  });

  it('refuses Add to inventory when the job has no part', () => {
    const component = create({ partId: null });
    component.formGroup.controls.disposition.setValue('AddToInventory');

    expect(component.formGroup.controls.disposition.hasError('noPart')).toBe(true);
    expect(getBinLocations).not.toHaveBeenCalled();
  });

  it('names the chosen disposition in the confirmation', () => {
    const component = create();
    const translate = TestBed.inject(TranslateService);
    const instant = vi.spyOn(translate, 'instant');
    component.formGroup.controls.disposition.setValue('Scrap');
    component.formGroup.controls.notes.setValue('cracked');

    component.save();

    expect(instant).toHaveBeenCalledWith('kanban.jobDisposed', { disposition: 'kanban.dispositionScrap' });
    expect(success).toHaveBeenCalled();
    expect(close).toHaveBeenCalledWith({ id: 7 });
  });
});
