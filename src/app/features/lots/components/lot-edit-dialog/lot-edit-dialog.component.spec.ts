import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';

import { of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { LotService } from '../../services/lot.service';
import { LotEditDialogComponent } from './lot-edit-dialog.component';

interface EditInternals {
  ngOnInit(): void;
  form: FormGroup<{ expirationDate: FormControl<Date | null>; supplierLotNumber: FormControl<string>; notes: FormControl<string> }>;
  save(): void;
}

describe('LotEditDialogComponent', () => {
  it('loads the lot values and saves the corrected expiry, supplier lot and notes', () => {
    const update = vi.fn(() => of({}));
    TestBed.configureTestingModule({
      providers: [
        { provide: LotService, useValue: { update } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new LotEditDialogComponent());
    mockSignalInputs(component, { lotId: 9, lotNumber: 'LOT-9', expirationDate: '2027-03-31T00:00:00Z', supplierLotNumber: 'S-1', notes: null });
    const dialog = component as unknown as EditInternals;
    dialog.ngOnInit();

    expect(dialog.form.controls.expirationDate.value?.getDate()).toBe(31);
    expect(dialog.form.controls.supplierLotNumber.value).toBe('S-1');
    dialog.form.patchValue({ expirationDate: new Date(2027, 5, 30), supplierLotNumber: ' S-2 ', notes: 'Keep dry' });
    dialog.save();

    expect(update).toHaveBeenCalledWith(9, { expirationDate: '2027-06-30T00:00:00Z', supplierLotNumber: 'S-2', notes: 'Keep dry' });
  });
});
