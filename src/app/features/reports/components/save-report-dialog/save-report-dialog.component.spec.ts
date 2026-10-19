import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Observable, of, throwError } from 'rxjs';

import { SaveReportDialogComponent, SaveReportDialogResult } from './save-report-dialog.component';

interface DialogInternals {
  form: FormGroup;
  saving(): boolean;
  save(): void;
}

describe('SaveReportDialogComponent', () => {
  let close: ReturnType<typeof vi.fn>;
  let submit: ReturnType<typeof vi.fn<(r: SaveReportDialogResult) => Observable<unknown>>>;

  function create(): DialogInternals {
    return TestBed.runInInjectionContext(() => new SaveReportDialogComponent()) as unknown as DialogInternals;
  }

  beforeEach(() => {
    close = vi.fn();
    submit = vi.fn<(r: SaveReportDialogResult) => Observable<unknown>>(() => of({}));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: { name: '', description: '', isShared: false, submit } },
      ],
    });
  });

  it('rejects a name made only of spaces', () => {
    const dialog = create();

    dialog.form.controls['name'].setValue('   ');

    expect(dialog.form.invalid).toBe(true);
  });

  it('rejects a description over 500 characters, as the server does', () => {
    const dialog = create();

    dialog.form.controls['name'].setValue('Monthly jobs');
    dialog.form.controls['description'].setValue('x'.repeat(501));

    expect(dialog.form.invalid).toBe(true);
  });

  it('closes only after the server accepts the save', () => {
    const dialog = create();
    dialog.form.controls['name'].setValue(' Monthly jobs ');

    dialog.save();

    expect(submit).toHaveBeenCalledWith({ name: 'Monthly jobs', description: '', isShared: false });
    expect(close).toHaveBeenCalledWith({ name: 'Monthly jobs', description: '', isShared: false });
  });

  it('stays open with the typed values when the server rejects the save', () => {
    submit.mockReturnValueOnce(throwError(() => new Error('400')));
    const dialog = create();
    dialog.form.controls['name'].setValue('Monthly jobs');
    dialog.form.controls['description'].setValue('Kept');

    dialog.save();

    expect(close).not.toHaveBeenCalled();
    expect(dialog.saving()).toBe(false);
    expect(dialog.form.controls['description'].value).toBe('Kept');
  });
});
