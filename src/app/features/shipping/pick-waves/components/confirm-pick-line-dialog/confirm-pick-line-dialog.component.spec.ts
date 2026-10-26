import { TestBed } from '@angular/core/testing';
import { Signal } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { mockSignalInputs } from '../../../../../../testing/signal-input-harness';
import { PickWaveService } from '../../services/pick-wave.service';
import { PickLine } from '../../models/pick-line.model';
import { SnackbarService } from '../../../../../shared/services/snackbar.service';
import { ConfirmPickLineDialogComponent } from './confirm-pick-line-dialog.component';

const LINE = {
  id: 8, waveId: 4, partNumber: 'P-1', requestedQuantity: 5, status: 'Pending', binPath: 'A / B', fromLocationName: 'B', lotNumber: null,
} as PickLine;

interface Internals {
  form: FormGroup;
  isShort: Signal<boolean>;
  ngOnInit(): void;
  save(): void;
}

describe('ConfirmPickLineDialogComponent', () => {
  const confirmLine = vi.fn(() => of(undefined));

  function create(): { c: Internals; confirmed: ReturnType<typeof vi.fn> } {
    const component = TestBed.runInInjectionContext(() => new ConfirmPickLineDialogComponent());
    mockSignalInputs(component, { line: LINE });
    const confirmed = vi.fn();
    component.confirmed.subscribe(confirmed);
    const c = component as unknown as Internals;
    c.ngOnInit();
    return { c, confirmed };
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    confirmLine.mockClear();
    TestBed.configureTestingModule({
      providers: [
        { provide: PickWaveService, useValue: { confirmLine } },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
  });

  it('confirms the full quantity by default', () => {
    const { c, confirmed } = create();
    expect(c.form.controls['pickedQuantity'].value).toBe(5);
    c.save();
    expect(confirmLine).toHaveBeenCalledWith(4, 8, { pickedQuantity: 5, shortNotes: null });
    expect(confirmed).toHaveBeenCalled();
  });

  it('needs a reason for a short pick', () => {
    const { c } = create();
    c.form.controls['pickedQuantity'].setValue(3);
    expect(c.isShort()).toBe(true);

    c.save();
    expect(confirmLine).not.toHaveBeenCalled();

    c.form.controls['shortNotes'].setValue('bin empty');
    c.save();
    expect(confirmLine).toHaveBeenCalledWith(4, 8, { pickedQuantity: 3, shortNotes: 'bin empty' });
  });

  it('refuses more than was asked for', () => {
    const { c } = create();
    c.form.controls['pickedQuantity'].setValue(6);
    c.save();
    expect(confirmLine).not.toHaveBeenCalled();
  });
});
