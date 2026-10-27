import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { ControlledDocumentCreateDialogComponent } from './controlled-document-create-dialog.component';
import { ControlledDocumentService } from '../../services/controlled-document.service';
import { PartsService } from '../../../parts/services/parts.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

interface DialogApi {
  form: { patchValue(v: Record<string, unknown>): void; controls: { partId: { setValue(v: number): void }; operationId: { setValue(v: number): void } } };
  operationOptions(): { value: unknown; label: string }[];
  save(): void;
}

describe('ControlledDocumentCreateDialogComponent', () => {
  it('creates a work instruction linked to a routing operation of the chosen part', () => {
    const create = vi.fn(() => of({ id: 2 }));
    const getOperations = vi.fn(() => of([{ id: 30, stepNumber: 20, title: 'Grind' }]));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: ControlledDocumentService, useValue: { create } },
        { provide: PartsService, useValue: { getOperations } },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
      ],
    });
    const dialog = TestBed.runInInjectionContext(() => new ControlledDocumentCreateDialogComponent()) as unknown as DialogApi;

    dialog.form.patchValue({ title: ' Grinding WI ' });
    dialog.form.controls.partId.setValue(7);
    expect(getOperations).toHaveBeenCalledWith(7);
    expect(dialog.operationOptions().map(o => o.value)).toEqual([null, 30]);
    dialog.form.controls.operationId.setValue(30);
    dialog.save();

    expect(create).toHaveBeenCalledWith({
      title: 'Grinding WI', description: null, category: 'WI', reviewIntervalDays: 365, partId: 7, operationId: 30,
    });
  });
});
