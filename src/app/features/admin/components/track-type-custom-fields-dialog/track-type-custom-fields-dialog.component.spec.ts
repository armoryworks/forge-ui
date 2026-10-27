import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideTranslateService } from '@ngx-translate/core';

import { of } from 'rxjs';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AdminService } from '../../services/admin.service';
import { customFieldKey, TrackTypeCustomFieldsDialogComponent } from './track-type-custom-fields-dialog.component';

interface FieldControls { controls: Record<string, { value: unknown; setValue(v: unknown): void }> }
interface DialogInternals {
  fields: { length: number; at(i: number): FieldControls };
  form: { invalid: boolean };
  add(): void;
  move(i: number, offset: -1 | 1): void;
  fillKey(i: number): void;
  save(): void;
}

describe('TrackTypeCustomFieldsDialogComponent', () => {
  const close = vi.fn();
  const admin = { getCustomFieldDefinitions: vi.fn(), updateCustomFieldDefinitions: vi.fn() };

  function build(): DialogInternals {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: { trackTypeId: 4, trackTypeName: 'Production' } },
        { provide: AdminService, useValue: admin },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
      ],
    });
    return TestBed.runInInjectionContext(() => new TrackTypeCustomFieldsDialogComponent()) as unknown as DialogInternals;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    admin.getCustomFieldDefinitions.mockReturnValue(of([
      { key: 'po_ref', label: 'PO ref', type: 'text', isRequired: true, options: null },
      { key: 'finish', label: 'Finish', type: 'select', isRequired: false, options: ['Matte', 'Gloss'] },
    ]));
    admin.updateCustomFieldDefinitions.mockReturnValue(of([]));
  });

  it('derives a storage key from the label', () => {
    expect(customFieldKey(' Heat Treat — Número ')).toBe('heat_treat_numero');
  });

  it('loads the definitions, reorders them and saves in the new order', () => {
    const dialog = build();
    expect(dialog.fields.length).toBe(2);

    dialog.move(1, -1);
    dialog.add();
    dialog.fields.at(2).controls['label'].setValue('Rush order');
    dialog.fillKey(2);
    dialog.fields.at(2).controls['type'].setValue('toggle');
    dialog.save();

    expect(admin.updateCustomFieldDefinitions).toHaveBeenCalledWith(4, [
      { key: 'finish', label: 'Finish', type: 'select', isRequired: false, options: ['Matte', 'Gloss'] },
      { key: 'po_ref', label: 'PO ref', type: 'text', isRequired: true, options: null },
      { key: 'rush_order', label: 'Rush order', type: 'toggle', isRequired: false, options: null },
    ]);
    expect(close).toHaveBeenCalledWith(true);
  });

  it('needs options for a select field and a unique key per field', () => {
    const dialog = build();
    dialog.fields.at(1).controls['options'].setValue(' , ');
    expect(dialog.form.invalid).toBe(true);

    dialog.fields.at(1).controls['options'].setValue('A');
    dialog.fields.at(1).controls['key'].setValue('PO_REF');
    expect(dialog.form.invalid).toBe(true);
    dialog.save();
    expect(admin.updateCustomFieldDefinitions).not.toHaveBeenCalled();
  });
});
