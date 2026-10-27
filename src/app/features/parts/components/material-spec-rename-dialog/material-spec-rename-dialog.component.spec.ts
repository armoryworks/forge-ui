import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { MaterialSpec } from '../../models/material-spec.model';
import { MaterialSpecService } from '../../services/material-spec.service';
import { MaterialSpecRenameDialogComponent } from './material-spec-rename-dialog.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

const SPEC: MaterialSpec = {
  id: 2, code: 'aluminum-6061', label: '6061-T6', parentId: 1, categoryLabel: 'Aluminum',
  sortOrder: 10, isActive: true, isSeedData: false, partCount: 3,
};

function setup() {
  TestBed.resetTestingModule();
  const update = vi.fn(() => of({ ...SPEC, label: '6061-T651' }));
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: MaterialSpecService, useValue: { update } },
      { provide: MatDialogRef, useValue: { close } },
      { provide: MAT_DIALOG_DATA, useValue: { spec: SPEC } },
      { provide: SnackbarService, useValue: { success: vi.fn() } },
    ],
  });
  const dialog = TestBed.runInInjectionContext(() => new MaterialSpecRenameDialogComponent());
  return { dialog, update, close, form: (dialog as unknown as { form: { controls: { label: { setValue(v: string): void } }; invalid: boolean } }).form };
}

describe('MaterialSpecRenameDialogComponent', () => {
  it('starts from the current name and saves the trimmed new one', () => {
    const { dialog, update, close, form } = setup();

    form.controls.label.setValue('  6061-T651 ');
    dialog.save();

    expect(update).toHaveBeenCalledWith(2, { label: '6061-T651' });
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ label: '6061-T651' }));
  });

  it('does not save a blank name', () => {
    const { dialog, update, form } = setup();

    form.controls.label.setValue('   ');
    dialog.save();

    expect(form.invalid).toBe(true);
    expect(update).not.toHaveBeenCalled();
  });
});
