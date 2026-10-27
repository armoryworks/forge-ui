import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { DeliverableDialogComponent } from './deliverable-dialog.component';
import { DeliverableService } from '../../services/deliverable.service';
import { ReferenceDataService } from '../../../../shared/services/reference-data.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

interface DialogApi {
  typeOptions(): { value: unknown; label: string }[] | null;
  form: { patchValue(v: Record<string, unknown>): void; invalid: boolean };
  save(): void;
}

function setup(types: { id: number; label: string; isActive: boolean }[]) {
  const create = vi.fn(() => of({ id: 6 }));
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
      { provide: MatDialogRef, useValue: { close: vi.fn() } },
      { provide: MAT_DIALOG_DATA, useValue: { projectId: 2, customerId: 4, deliverable: null } },
      { provide: DeliverableService, useValue: { create } },
      { provide: ReferenceDataService, useValue: { getByGroup: vi.fn(() => of(types)) } },
      { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
    ],
  });
  return { dialog: TestBed.runInInjectionContext(() => new DeliverableDialogComponent()) as unknown as DialogApi, create };
}

describe('DeliverableDialogComponent', () => {
  it('offers only active deliverable types and needs one before saving', () => {
    const { dialog, create } = setup([{ id: 1, label: 'Report', isActive: true }, { id: 2, label: 'Old', isActive: false }]);
    expect(dialog.typeOptions()).toEqual([{ value: 1, label: 'Report' }]);

    dialog.form.patchValue({ name: 'Inspection report' });
    expect(dialog.form.invalid).toBe(true);
    dialog.form.patchValue({ deliverableTypeId: 1 });
    dialog.save();

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Inspection report', deliverableTypeId: 1, projectId: 2, customerId: 4 }));
  });

  it('reports when no deliverable types are set up', () => {
    expect(setup([]).dialog.typeOptions()).toEqual([]);
  });
});
