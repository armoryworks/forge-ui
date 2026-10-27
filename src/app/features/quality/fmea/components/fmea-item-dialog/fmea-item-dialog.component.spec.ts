import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { FmeaItemDialogComponent } from './fmea-item-dialog.component';
import { FmeaService } from '../../services/fmea.service';
import { FmeaItem } from '../../models/fmea-item.model';
import { SnackbarService } from '../../../../../shared/services/snackbar.service';

interface DialogApi {
  form: { patchValue(v: Record<string, unknown>): void; invalid: boolean };
  rpn(): number;
  needsAction(): boolean;
  save(): void;
}

function setup(item: FmeaItem | null) {
  const service = { addItem: vi.fn(() => of({ id: 1 })), updateItem: vi.fn(() => of({ id: 7 })) };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
      { provide: MatDialogRef, useValue: { close: vi.fn() } },
      { provide: MAT_DIALOG_DATA, useValue: { fmeaId: 4, item } },
      { provide: FmeaService, useValue: service },
      { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
    ],
  });
  return { dialog: TestBed.runInInjectionContext(() => new FmeaItemDialogComponent()) as unknown as DialogApi, service };
}

describe('FmeaItemDialogComponent', () => {
  it('computes the RPN as severity × occurrence × detection and flags it for action', () => {
    const { dialog } = setup(null);

    dialog.form.patchValue({ severity: 8, occurrence: 5, detection: 5 });
    expect(dialog.rpn()).toBe(200);
    expect(dialog.needsAction()).toBe(true);

    dialog.form.patchValue({ severity: 3, occurrence: 2, detection: 2 });
    expect(dialog.needsAction()).toBe(false);

    dialog.form.patchValue({ severity: 9, occurrence: 1, detection: 1 });
    expect(dialog.needsAction()).toBe(true);
  });

  it('adds a new failure mode with blank optional fields sent as null', () => {
    const { dialog, service } = setup(null);
    dialog.form.patchValue({ failureMode: ' Porosity ', potentialEffect: 'Leak', severity: 7, occurrence: 6, detection: 5 });

    dialog.save();

    expect(service.addItem).toHaveBeenCalledWith(4, expect.objectContaining({
      failureMode: 'Porosity', potentialEffect: 'Leak', severity: 7, occurrence: 6, detection: 5, processStep: null, targetCompletionDate: null,
    }));
  });

  it('updates an existing failure mode', () => {
    const { dialog, service } = setup({ id: 7, itemNumber: 1, failureMode: 'Crack', potentialEffect: 'Leak', severity: 5, occurrence: 5, detection: 5 } as FmeaItem);

    dialog.save();

    expect(service.updateItem).toHaveBeenCalledWith(4, 7, expect.objectContaining({ failureMode: 'Crack' }));
  });

  it('will not save without a failure mode and effect', () => {
    const { dialog, service } = setup(null);

    expect(dialog.form.invalid).toBe(true);
    dialog.save();
    expect(service.addItem).not.toHaveBeenCalled();
  });
});
