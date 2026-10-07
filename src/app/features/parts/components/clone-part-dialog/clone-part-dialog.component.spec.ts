import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { ManualNumberSettingsService } from '../../../../shared/services/manual-number-settings.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { PartsService } from '../../services/parts.service';
import { PartDetail } from '../../models/part-detail.model';
import { ClonePartRequest } from '../../models/clone-part-request.model';
import { ClonePartDialogComponent } from './clone-part-dialog.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

type DialogInternals = {
  form: ClonePartDialogComponent['form'];
  materialsDropped: () => boolean;
};

describe('ClonePartDialogComponent', () => {
  const source = { id: 4, partNumber: 'ASM-00007', name: 'Valve body', description: 'Brass' } as PartDetail;
  let clonePart: ReturnType<typeof vi.fn>;
  let close: ReturnType<typeof vi.fn>;
  let manualEnabled: boolean;

  function create(): ClonePartDialogComponent {
    return TestBed.runInInjectionContext(() => new ClonePartDialogComponent());
  }

  beforeEach(() => {
    manualEnabled = false;
    clonePart = vi.fn().mockReturnValue(of({ id: 9, partNumber: 'ASM-00008', name: 'Valve body (copy)' }));
    close = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: PartsService, useValue: { clonePart } },
        { provide: ManualNumberSettingsService, useValue: { isEnabled: () => manualEnabled } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: { part: source } },
      ],
    });
  });

  it('defaults to copying BOM and routing but not vendor sources', () => {
    const form = (create() as unknown as DialogInternals).form;

    expect(form.controls.copyBom.value).toBe(true);
    expect(form.controls.copyRouting.value).toBe(true);
    expect(form.controls.copyVendorSources.value).toBe(false);
    expect(form.controls.description.value).toBe('Brass');
  });

  it('posts the options to the source part and closes with the new part', () => {
    const dialog = create();
    const form = (dialog as unknown as DialogInternals).form;
    form.patchValue({ name: '  Valve body, 3/4 in ', copyVendorSources: true });

    dialog.save();

    const request = clonePart.mock.calls[0][1] as ClonePartRequest;
    expect(clonePart.mock.calls[0][0]).toBe(4);
    expect(request).toEqual({
      name: 'Valve body, 3/4 in', description: 'Brass',
      copyBom: true, copyRouting: true, copyVendorSources: true,
    });
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ id: 9 }));
  });

  it('drops a typed part number while manual numbers are off', () => {
    const dialog = create();
    (dialog as unknown as DialogInternals).form.patchValue({ partNumber: 'VB-075' });

    dialog.save();

    expect((clonePart.mock.calls[0][1] as ClonePartRequest).partNumber).toBeUndefined();
  });

  it('sends the typed part number when manual numbers are on', () => {
    manualEnabled = true;
    const dialog = create();
    (dialog as unknown as DialogInternals).form.patchValue({ partNumber: ' VB-075 ' });

    dialog.save();

    expect((clonePart.mock.calls[0][1] as ClonePartRequest).partNumber).toBe('VB-075');
  });

  it('flags that operation materials are dropped when routing is copied without the BOM', () => {
    const internals = create() as unknown as DialogInternals;
    expect(internals.materialsDropped()).toBe(false);

    internals.form.controls.copyBom.setValue(false);

    expect(internals.materialsDropped()).toBe(true);
  });
});
