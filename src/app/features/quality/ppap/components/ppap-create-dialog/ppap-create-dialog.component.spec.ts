import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { PpapCreateDialogComponent } from './ppap-create-dialog.component';
import { PpapService } from '../../services/ppap.service';
import { SnackbarService } from '../../../../../shared/services/snackbar.service';

interface DialogApi {
  form: { patchValue(v: Record<string, unknown>): void; invalid: boolean };
  save(): void;
}

describe('PpapCreateDialogComponent', () => {
  it('needs a part and a customer, then creates the submission at the chosen level', () => {
    const create = vi.fn(() => of({ id: 8 }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: PpapService, useValue: { create } },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
      ],
    });
    const dialog = TestBed.runInInjectionContext(() => new PpapCreateDialogComponent()) as unknown as DialogApi;

    expect(dialog.form.invalid).toBe(true);
    dialog.form.patchValue({ partId: 1, customerId: 2, ppapLevel: 2, reason: 'EngineeringChange', partRevision: ' C ' });
    dialog.save();

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      partId: 1, customerId: 2, ppapLevel: 2, reason: 'EngineeringChange', partRevision: 'C', dueDate: null,
    }));
  });
});
