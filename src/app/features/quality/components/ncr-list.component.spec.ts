import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Signal } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { of } from 'rxjs';

import { NcrListComponent } from './ncr-list.component';
import { NcrCapaService } from '../services/ncr-capa.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { NonConformance } from '../models/non-conformance.model';
import { NcrDispositionCode } from '../models/ncr-disposition-code.model';

interface DispositionView {
  dispositionForm: FormGroup<{
    code: FormControl<NcrDispositionCode>;
    notes: FormControl<string | null>;
    reworkInstructions: FormControl<string | null>;
  }>;
  notesRequired: Signal<boolean>;
  dispositionViolations: Signal<string[]>;
  openDisposition(ncr: NonConformance): void;
  saveDisposition(): void;
}

describe('NcrListComponent disposition dialog', () => {
  let dispositionNcr: ReturnType<typeof vi.fn>;
  let view: DispositionView;

  beforeEach(() => {
    TestBed.resetTestingModule();
    dispositionNcr = vi.fn(() => of(undefined));
    TestBed.configureTestingModule({
      providers: [
        { provide: NcrCapaService, useValue: { dispositionNcr, getNcrs: vi.fn(() => of([])) } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
      ],
    });
    view = TestBed.runInInjectionContext(() => new NcrListComponent()) as unknown as DispositionView;
    view.openDisposition({ id: 5 } as NonConformance);
  });

  it('requires notes for the default Use As Is code and blocks the save', () => {
    expect(view.notesRequired()).toBe(true);
    expect(view.dispositionForm.invalid).toBe(true);
    expect(view.dispositionViolations()).toContain('Notes is required');

    view.saveDisposition();

    expect(dispositionNcr).not.toHaveBeenCalled();
  });

  it('treats whitespace-only notes as missing for Reject', () => {
    view.dispositionForm.controls.code.setValue('Reject');
    view.dispositionForm.controls.notes.setValue('   ');

    expect(view.dispositionForm.invalid).toBe(true);
  });

  it('does not require notes for Scrap', () => {
    view.dispositionForm.controls.code.setValue('Scrap');

    expect(view.notesRequired()).toBe(false);
    expect(view.dispositionForm.valid).toBe(true);
  });

  it('requires rework instructions only for Rework', () => {
    view.dispositionForm.controls.code.setValue('Rework');
    expect(view.dispositionViolations()).toEqual(['Rework Instructions is required']);

    view.dispositionForm.controls.reworkInstructions.setValue('Re-machine the bore');
    expect(view.dispositionForm.valid).toBe(true);
  });

  it('sends the disposition once Use As Is has notes', () => {
    view.dispositionForm.controls.notes.setValue('Customer deviation approved');

    view.saveDisposition();

    expect(dispositionNcr).toHaveBeenCalledWith(5, expect.objectContaining({
      code: 'UseAsIs',
      notes: 'Customer deviation approved',
    }));
  });
});
