import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Observable, of, throwError } from 'rxjs';

import { provideTranslateService, TranslateLoader, TranslateService } from '@ngx-translate/core';

import { DisposeJobDialogComponent, DisposeJobDialogData } from './dispose-job-dialog.component';
import { KanbanService } from '../services/kanban.service';
import { JobDispositionStock } from '../models/job-disposition-stock.model';
import { InventoryService } from '../../inventory/services/inventory.service';
import { CapabilityService } from '../../../shared/services/capability.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

describe('DisposeJobDialogComponent', () => {
  const disposeJob = vi.fn();
  const getBinLocations = vi.fn();
  const getDispositionStock = vi.fn();
  const getDispositionExpenseAccounts = vi.fn();
  const getSurplusSplit = vi.fn();
  const isEnabled = vi.fn();
  const success = vi.fn();
  const close = vi.fn();

  function create(data: Partial<DisposeJobDialogData> = {}): DisposeJobDialogComponent {
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: MAT_DIALOG_DATA, useValue: { jobId: 7, jobNumber: 'JOB-0007', currentDisposition: null, ...data } },
        { provide: MatDialogRef, useValue: { close } },
        { provide: KanbanService, useValue: { disposeJob, getDispositionStock, getDispositionExpenseAccounts, getSurplusSplit } },
        { provide: InventoryService, useValue: { getBinLocations } },
        { provide: CapabilityService, useValue: { isEnabled } },
        { provide: SnackbarService, useValue: { success } },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new DisposeJobDialogComponent());
    (component as unknown as { dialogRef: { clearDraft: () => void } }).dialogRef = { clearDraft: vi.fn() };
    return component;
  }

  function stock(overrides: Partial<JobDispositionStock> = {}): JobDispositionStock {
    return {
      partId: 3, hasSeveralParts: false, defaultBinId: 3, receivedQuantity: 0, recordedQuantity: 0, hasOpenRuns: false,
      ...overrides,
    };
  }

  function binValues(component: DisposeJobDialogComponent): unknown[] {
    return (component as unknown as { binOptions: () => { value: unknown }[] }).binOptions().map(o => o.value);
  }

  function optionValues(component: DisposeJobDialogComponent): unknown[] {
    return component.dispositionOptions.map(o => o.value);
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllMocks();
    disposeJob.mockReturnValue(of({ id: 7 }));
    getBinLocations.mockReturnValue(of([
      { id: 1, name: 'A-01', locationType: 'Bin', barcode: null, locationPath: 'Main / A-01', isActive: true },
      { id: 3, name: 'A-03', locationType: 'Bin', barcode: null, locationPath: 'Main / A-03', isActive: true },
      { id: 4, name: 'A-04', locationType: 'Bin', barcode: null, locationPath: 'Main / A-04', isActive: false },
    ]));
    getDispositionStock.mockReturnValue(of(stock()));
    getDispositionExpenseAccounts.mockReturnValue(of([{ id: 61, accountNumber: '61000', name: 'Scrap and Rework' }]));
    isEnabled.mockReturnValue(true);
    getSurplusSplit.mockImplementation((_jobId: number, quantity: number) =>
      of({ demandQuantity: quantity, surplusQuantity: 0, surplusLocationId: null, surplusLocationName: null }));
  });

  it('pre-fills the surplus bin and sends it when the good quantity goes beyond the order', () => {
    getSurplusSplit.mockReturnValue(of({ demandQuantity: 100, surplusQuantity: 14, surplusLocationId: 1, surplusLocationName: 'A-01' }));
    const component = create();
    component.formGroup.controls.disposition.setValue('AddToInventory');
    component.formGroup.controls.goodQuantity.setValue(114);

    expect(getSurplusSplit).toHaveBeenLastCalledWith(7, 114);
    expect((component as unknown as { surplusSplit: () => { surplusQuantity: number } }).surplusSplit().surplusQuantity).toBe(14);
    expect(component.formGroup.controls.surplusLocationId.value).toBe(1);

    component.formGroup.controls.surplusLocationId.setValue(3);
    component.save();

    expect(disposeJob).toHaveBeenCalledWith(7, expect.objectContaining({ goodQuantity: 114, locationId: 3, surplusLocationId: 3 }));
  });

  it('sends no surplus bin when nothing goes beyond the order', () => {
    const component = create();
    component.formGroup.controls.disposition.setValue('AddToInventory');
    component.formGroup.controls.goodQuantity.setValue(50);

    component.save();

    expect(disposeJob.mock.calls[0][1].surplusLocationId).toBeUndefined();
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

  it.each(['Scrap', 'HoldForReview', 'EnteredInError', 'Other'] as const)('requires a reason for %s', disposition => {
    const component = create();
    component.formGroup.controls.disposition.setValue(disposition);

    expect(component.formGroup.controls.notes.hasError('required')).toBe(true);
    expect(component.formGroup.controls.notes.getError('required')).toEqual({ message: 'kanban.dispositionNotesRequired' });

    component.formGroup.controls.notes.setValue('   ');
    expect(component.formGroup.controls.notes.hasError('required')).toBe(true);

    component.formGroup.controls.notes.setValue('cracked housing');
    expect(component.formGroup.controls.notes.valid).toBe(true);

    component.formGroup.controls.notes.setValue('');
    component.formGroup.controls.disposition.setValue('ShipToCustomer');

    expect(component.formGroup.controls.notes.hasError('required')).toBe(false);
  });

  it('asks for a good quantity and defaults the bin to the part default bin', () => {
    const component = create();
    component.formGroup.controls.disposition.setValue('AddToInventory');

    expect(getDispositionStock).toHaveBeenCalledWith(7);
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

  it('offers only active bins plus the default fallback, and lets the bin stay empty', () => {
    getDispositionStock.mockReturnValue(of(stock({ defaultBinId: null })));
    const component = create();
    component.formGroup.controls.disposition.setValue('AddToInventory');
    component.formGroup.controls.goodQuantity.setValue(5);

    expect(binValues(component)).toEqual([null, 1, 3]);
    expect(component.formGroup.valid).toBe(true);

    component.save();

    expect(disposeJob).toHaveBeenCalledWith(7, expect.objectContaining({ goodQuantity: 5, locationId: undefined }));
  });

  it('prefills what the runs already recorded and refuses less', () => {
    getDispositionStock.mockReturnValue(of(stock({ receivedQuantity: 500, recordedQuantity: 20 })));
    const component = create();
    component.formGroup.controls.disposition.setValue('AddToInventory');

    expect(component.formGroup.controls.goodQuantity.value).toBe(520);
    expect(component.formGroup.valid).toBe(true);

    component.formGroup.controls.goodQuantity.setValue(400);

    expect(component.formGroup.controls.goodQuantity.hasError('min')).toBe(true);
  });

  it.each([
    [{ partId: null }, 'kanban.dispositionNoPart'],
    [{ partId: null, hasSeveralParts: true }, 'kanban.dispositionSeveralParts'],
    [{ hasOpenRuns: true }, 'kanban.dispositionOpenRuns'],
  ] as const)('refuses Add to inventory when the stock check says %o', (overrides, message) => {
    getDispositionStock.mockReturnValue(of(stock(overrides)));
    const component = create();
    component.formGroup.controls.disposition.setValue('AddToInventory');

    expect(component.formGroup.controls.disposition.getError('stockProblem')).toEqual({ message });
    expect(component.formGroup.controls.goodQuantity.validator).toBeNull();
  });

  it('skips the bin choice and lets the server pick the main location when multi-location is off', () => {
    isEnabled.mockImplementation((code: string) => code !== 'CAP-INV-MULTILOC');
    const component = create();
    component.formGroup.controls.disposition.setValue('AddToInventory');

    expect(getBinLocations).not.toHaveBeenCalled();
    expect(component.formGroup.controls.locationId.value).toBeNull();

    component.formGroup.controls.goodQuantity.setValue(500);
    component.save();

    expect(disposeJob).toHaveBeenCalledWith(7, expect.objectContaining({ goodQuantity: 500, locationId: undefined }));
  });

  it('says the stock check failed and retries it on request', () => {
    getDispositionStock.mockReturnValueOnce(throwError(() => new Error('boom')));
    const component = create();
    component.formGroup.controls.disposition.setValue('AddToInventory');

    expect(component.formGroup.controls.disposition.getError('stockProblem'))
      .toEqual({ message: 'kanban.dispositionStockLoadFailed' });

    (component as unknown as { retryStock: () => void }).retryStock();

    expect(getDispositionStock).toHaveBeenCalledTimes(2);
    expect(component.formGroup.controls.disposition.valid).toBe(true);
    expect(component.formGroup.controls.goodQuantity.hasError('required')).toBe(true);
  });

  it('only stamps the job when production completion is turned off', () => {
    isEnabled.mockReturnValue(false);
    const component = create();
    component.formGroup.controls.disposition.setValue('AddToInventory');

    expect(getDispositionStock).not.toHaveBeenCalled();
    expect(component.formGroup.valid).toBe(true);

    component.save();

    expect(disposeJob).toHaveBeenCalledWith(7, {
      disposition: 'AddToInventory',
      notes: undefined,
      goodQuantity: undefined,
      locationId: undefined,
    });
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

  it('offers the write-off account for Other while the GL is on and sends the chosen account', () => {
    const component = create();
    component.formGroup.controls.disposition.setValue('Other');

    expect(getDispositionExpenseAccounts).toHaveBeenCalledTimes(1);
    expect((component as unknown as { writeOffOptions: () => { value: unknown }[] }).writeOffOptions().map(o => o.value))
      .toEqual([null, 61]);

    component.formGroup.controls.expenseGlAccountId.setValue(61);
    component.formGroup.controls.notes.setValue('Customer cancelled the order');
    component.save();

    expect(disposeJob).toHaveBeenCalledWith(7, expect.objectContaining({ disposition: 'Other', expenseGlAccountId: 61 }));
  });

  it('does not ask for a write-off account while the GL is off', () => {
    isEnabled.mockImplementation((code: string) => code !== 'CAP-ACCT-FULLGL');
    const component = create();
    component.formGroup.controls.disposition.setValue('Other');
    component.formGroup.controls.expenseGlAccountId.setValue(61);
    component.formGroup.controls.notes.setValue('Cancelled');

    component.save();

    expect(getDispositionExpenseAccounts).not.toHaveBeenCalled();
    expect(disposeJob).toHaveBeenCalledWith(7, expect.objectContaining({ expenseGlAccountId: undefined }));
  });
});
