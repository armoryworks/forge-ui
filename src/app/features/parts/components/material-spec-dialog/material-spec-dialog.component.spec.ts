import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of, throwError } from 'rxjs';

import { ReferenceDataItem } from '../../../../shared/services/reference-data.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { CreateMaterialSpecRequest } from '../../models/create-material-spec-request.model';
import { MaterialSpecService } from '../../services/material-spec.service';
import { MaterialSpecDialogComponent, NEW_MATERIAL_CATEGORY } from './material-spec-dialog.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

type DialogInternals = {
  form: MaterialSpecDialogComponent['form'];
  categoryOptions: { value: unknown; label: string }[];
  creatingCategory: () => boolean;
  saving: () => boolean;
};

function item(id: number, label: string, sortOrder: number, parentId: number | null, isActive = true): ReferenceDataItem {
  return { id, groupCode: 'part.material_spec', code: label.toLowerCase(), label, sortOrder, isActive, parentId };
}

describe('MaterialSpecDialogComponent', () => {
  const items = [
    item(2, 'Steel', 20, null),
    item(1, 'Aluminum', 10, null),
    item(3, '6061-T6', 10, 1),
    item(4, 'Retired', 30, null, false),
    item(5, '1018', 10, 2),
    item(6, 'Wood', 40, null),
    item(7, 'Old grade', 10, 4, false),
  ];
  const created = item(9, '7075-T6', 20, 1);
  let create: ReturnType<typeof vi.fn>;
  let close: ReturnType<typeof vi.fn>;

  function build(): MaterialSpecDialogComponent {
    return TestBed.runInInjectionContext(() => new MaterialSpecDialogComponent());
  }

  beforeEach(() => {
    create = vi.fn().mockReturnValue(of(created));
    close = vi.fn();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: MaterialSpecService, useValue: { create } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: { items } },
      ],
    });
  });

  it('offers no category, the active top-level rows that have children in order, and a new category', () => {
    const options = (build() as unknown as DialogInternals).categoryOptions;

    expect(options.map(o => o.value)).toEqual([null, 1, 2, NEW_MATERIAL_CATEGORY]);
  });

  it('posts a leaf under the chosen category and closes with the created row', () => {
    const dialog = build();
    (dialog as unknown as DialogInternals).form.patchValue({ category: 1, label: '  7075-T6 ' });

    dialog.save();

    expect(create.mock.calls[0][0] as CreateMaterialSpecRequest).toEqual({ label: '7075-T6', parentId: 1 });
    expect(close).toHaveBeenCalledWith(created);
  });

  it('requires and sends a category name when creating a new category', () => {
    const dialog = build();
    const internals = dialog as unknown as DialogInternals;
    expect(internals.form.controls.newCategoryLabel.disabled).toBe(true);

    internals.form.patchValue({ category: NEW_MATERIAL_CATEGORY, label: 'Grade 9' });
    expect(internals.creatingCategory()).toBe(true);
    expect(internals.form.invalid).toBe(true);

    internals.form.patchValue({ newCategoryLabel: ' Magnesium ' });
    dialog.save();

    expect(create.mock.calls[0][0]).toEqual({ label: 'Grade 9', newCategoryLabel: 'Magnesium' });
  });

  it('sends a standalone material when no category is chosen', () => {
    const dialog = build();
    (dialog as unknown as DialogInternals).form.patchValue({ label: 'Wood' });

    dialog.save();

    expect(create.mock.calls[0][0]).toEqual({ label: 'Wood' });
  });

  it('does not post without a name', () => {
    const dialog = build();
    (dialog as unknown as DialogInternals).form.patchValue({ category: 1, label: '   ' });

    dialog.save();

    expect(create).not.toHaveBeenCalled();
  });

  it('stays open when the server rejects a duplicate', () => {
    create.mockReturnValue(throwError(() => new Error('409')));
    const dialog = build();
    const internals = dialog as unknown as DialogInternals;
    internals.form.patchValue({ category: 1, label: '6061-T6' });

    dialog.save();

    expect(close).not.toHaveBeenCalled();
    expect(internals.saving()).toBe(false);
  });

  it('closes with null on cancel', () => {
    build().close();

    expect(close).toHaveBeenCalledWith(null);
  });
});
