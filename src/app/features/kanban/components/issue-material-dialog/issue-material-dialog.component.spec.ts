import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of, throwError } from 'rxjs';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { PartBinLocation } from '../../../inventory/models/part-bin-location.model';
import { InventoryService } from '../../../inventory/services/inventory.service';
import { IssuableMaterial } from '../../models/issuable-material.model';
import { MaterialIssue } from '../../models/job-cost.model';
import { JobCostService } from '../../services/job-cost.service';
import { IssueMaterialDialogComponent } from './issue-material-dialog.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

const MATERIALS: IssuableMaterial[] = [
  { partId: 4, partNumber: 'RS-PA66', description: null, perUnit: 0.02, requiredQuantity: 100, issuedQuantity: 20, alternateForPartId: null, alternateForPartNumber: null },
  { partId: 61, partNumber: 'RS-PA66-ALT', description: null, perUnit: 0.02, requiredQuantity: 100, issuedQuantity: 0, alternateForPartId: 4, alternateForPartNumber: 'RS-PA66' },
];

function bin(overrides: Partial<PartBinLocation> = {}): PartBinLocation {
  return {
    binContentId: 11, locationPath: 'Resin / R1', quantity: 50, reservedQuantity: 0, availableQuantity: 50,
    lotNumber: 'R-26-117', status: 'Stored', ...overrides,
  };
}

function setup(bins: PartBinLocation[], issueMaterial = vi.fn(() => of({ id: 3, quantity: 5, partNumber: 'RS-PA66' } as MaterialIssue))) {
  const close = vi.fn();
  const success = vi.fn();
  const getIssuableMaterials = vi.fn(() => of(MATERIALS));
  const getPartBins = vi.fn(() => of(bins));
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: MAT_DIALOG_DATA, useValue: { jobId: 2 } },
      { provide: MatDialogRef, useValue: { close } },
      { provide: JobCostService, useValue: { getIssuableMaterials, issueMaterial } },
      { provide: InventoryService, useValue: { getPartBins } },
      { provide: SnackbarService, useValue: { success } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new IssueMaterialDialogComponent());
  return { component, issueMaterial, close, success, getIssuableMaterials, getPartBins };
}

describe('IssueMaterialDialogComponent', () => {
  it('offers the BOM components and approved alternates of the job', () => {
    const { component, getIssuableMaterials } = setup([]);

    expect(getIssuableMaterials).toHaveBeenCalledWith(2);
    expect(component.partOptions().map(o => o.value)).toEqual([4, 61]);
  });

  it('lists only bins that are not on hold and have stock, and picks the only one', () => {
    const { component, getPartBins } = setup([
      bin({ binContentId: 11 }),
      bin({ binContentId: 12, status: 'QcHold' }),
      bin({ binContentId: 13, availableQuantity: 0 }),
    ]);

    component.formGroup.controls.partId.setValue(4);

    expect(getPartBins).toHaveBeenCalledWith(4);
    expect(component.binOptions().map(o => o.value)).toEqual([11]);
    expect(component.formGroup.controls.binContentId.value).toBe(11);
  });

  it('issues from the chosen bin and closes with the issue', () => {
    const { component, issueMaterial, close, success } = setup([bin()]);
    component.formGroup.controls.partId.setValue(4);
    component.formGroup.controls.quantity.setValue(5);

    component.save();

    expect(issueMaterial).toHaveBeenCalledWith(2, { partId: 4, quantity: 5, binContentId: 11, issueType: 'Issue' });
    expect(success).toHaveBeenCalled();
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }));
  });

  it('refuses more than the bin has available', () => {
    const { component, issueMaterial } = setup([bin({ availableQuantity: 4 })]);
    component.formGroup.controls.partId.setValue(4);
    component.formGroup.controls.quantity.setValue(5);

    component.save();

    expect(component.formGroup.controls.quantity.hasError('max')).toBe(true);
    expect(issueMaterial).not.toHaveBeenCalled();
  });

  it('clears the bin when the part changes', () => {
    const { component } = setup([bin()]);
    component.formGroup.controls.partId.setValue(4);
    component.formGroup.controls.binContentId.setValue(99);

    component.formGroup.controls.partId.setValue(null);

    expect(component.formGroup.controls.binContentId.value).toBeNull();
  });

  it('stays open when the issue is refused', () => {
    const { component, close } = setup([bin()], vi.fn(() => throwError(() => new Error('expired'))));
    component.formGroup.controls.partId.setValue(4);
    component.formGroup.controls.quantity.setValue(5);

    component.save();

    expect(close).not.toHaveBeenCalled();
  });
});
