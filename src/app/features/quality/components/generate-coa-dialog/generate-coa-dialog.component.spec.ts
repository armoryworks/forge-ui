import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { GenerateCoaDialogComponent } from './generate-coa-dialog.component';
import { CoaService } from '../../services/coa.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

interface DialogApi {
  form: { patchValue(v: Record<string, unknown>): void };
  generate(): void;
}

describe('GenerateCoaDialogComponent', () => {
  it('generates the certificate for the lot with the customer, language and notes chosen', () => {
    const generate = vi.fn(() => of({ id: 1, conforms: false }));
    const close = vi.fn();
    const success = vi.fn();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: { lotId: 5, lotNumber: 'L-5' } },
        { provide: CoaService, useValue: { generate } },
        { provide: SnackbarService, useValue: { success, errorFrom: vi.fn() } },
      ],
    });
    const dialog = TestBed.runInInjectionContext(() => new GenerateCoaDialogComponent()) as unknown as DialogApi;

    dialog.form.patchValue({ customerId: 2, language: 'es', notes: '  For PO 77  ' });
    dialog.generate();

    expect(generate).toHaveBeenCalledWith({ lotId: 5, customerId: 2, language: 'es', notes: 'For PO 77' });
    expect(success).toHaveBeenCalledWith('coa.generatedNonConforming');
    expect(close).toHaveBeenCalledWith({ id: 1, conforms: false });
  });
});
