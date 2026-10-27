import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { FmeaActionDialogComponent } from './fmea-action-dialog.component';
import { FmeaService } from '../../services/fmea.service';
import { FmeaItem } from '../../models/fmea-item.model';
import { SnackbarService } from '../../../../../shared/services/snackbar.service';

interface DialogApi {
  form: { patchValue(v: Record<string, unknown>): void };
  revisedRpn(): number;
  save(): void;
}

describe('FmeaActionDialogComponent', () => {
  it('carries unchanged ratings into the revised RPN and records the action', () => {
    const recordAction = vi.fn(() => of({ id: 1 }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: MAT_DIALOG_DATA, useValue: { fmeaId: 4, item: { id: 1, itemNumber: 1, severity: 7, occurrence: 6, detection: 5, rpn: 210, actionTaken: null, revisedSeverity: null, revisedOccurrence: null, revisedDetection: null } as unknown as FmeaItem } },
        { provide: FmeaService, useValue: { recordAction } },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
      ],
    });
    const dialog = TestBed.runInInjectionContext(() => new FmeaActionDialogComponent()) as unknown as DialogApi;

    dialog.form.patchValue({ actionTaken: 'Added pre-heat', revisedOccurrence: 3 });
    expect(dialog.revisedRpn()).toBe(105);
    dialog.save();

    expect(recordAction).toHaveBeenCalledWith(4, 1, { actionTaken: 'Added pre-heat', revisedSeverity: null, revisedOccurrence: 3, revisedDetection: null });
  });
});
