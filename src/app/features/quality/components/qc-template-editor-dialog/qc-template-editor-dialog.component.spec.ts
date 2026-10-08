import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Signal } from '@angular/core';
import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { of } from 'rxjs';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';

import { QcTemplateEditorDialogComponent } from './qc-template-editor-dialog.component';
import { QualityService } from '../../services/quality.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { QcTemplate } from '../../models/qc-template.model';

interface EditorView {
  form: FormGroup<{ name: FormControl<string>; items: FormArray<FormGroup> }>;
  violations: Signal<string[]>;
  canSave: Signal<boolean>;
  addItem(): void;
  removeItem(index: number): void;
  moveItem(index: number, delta: number): void;
  save(): void;
}

function setup(template: QcTemplate | null) {
  TestBed.resetTestingModule();
  const createTemplate = vi.fn((body: unknown) => of({ id: 9, ...(body as object) }));
  const updateTemplate = vi.fn((_id: number, body: unknown) => of({ id: 4, ...(body as object) }));
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: QualityService, useValue: { createTemplate, updateTemplate } },
      { provide: SnackbarService, useValue: { success: vi.fn() } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
      { provide: MatDialogRef, useValue: { close } },
      { provide: MAT_DIALOG_DATA, useValue: { template } },
    ],
  });
  const view = TestBed.runInInjectionContext(() => new QcTemplateEditorDialogComponent()) as unknown as EditorView;
  return { view, createTemplate, updateTemplate, close };
}

describe('QcTemplateEditorDialogComponent', () => {
  it('cannot save a new template until it has a name and an item with a description', () => {
    const { view, createTemplate } = setup(null);

    expect(view.violations()).toEqual(['qcInspections.nameRequired', 'qcInspections.noItems']);
    view.form.controls.name.setValue('Dimensional');
    view.addItem();
    expect(view.violations()).toEqual(['qcInspections.itemDescriptionRequired']);
    expect(view.canSave()).toBe(false);

    view.save();

    expect(createTemplate).not.toHaveBeenCalled();
  });

  it('creates a template with three ordered items', () => {
    const { view, createTemplate, close } = setup(null);
    view.form.controls.name.setValue(' Dimensional ');
    for (const [description, specification, isRequired] of [
      ['Length', '10 mm +/- 0.1', true],
      ['Width', '', true],
      ['Finish', 'Ra 1.6', false],
    ] as const) {
      view.addItem();
      view.form.controls.items.at(view.form.controls.items.length - 1).patchValue({ description, specification, isRequired });
    }
    view.moveItem(2, -1);

    view.save();

    expect(createTemplate).toHaveBeenCalledWith({
      name: 'Dimensional',
      description: undefined,
      partId: undefined,
      items: [
        { description: 'Length', specification: '10 mm +/- 0.1', sortOrder: 0, isRequired: true },
        { description: 'Finish', specification: 'Ra 1.6', sortOrder: 1, isRequired: false },
        { description: 'Width', specification: undefined, sortOrder: 2, isRequired: true },
      ],
    });
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ id: 9 }));
  });

  it('edits an existing template, keeping item ids and dropping removed items', () => {
    const { view, updateTemplate } = setup({
      id: 4,
      name: 'Visual',
      description: 'Cosmetic',
      partId: 7,
      partNumber: 'P-1001',
      isActive: true,
      items: [
        { id: 21, description: 'Scratches', specification: null, sortOrder: 1, isRequired: true },
        { id: 20, description: 'Color', specification: 'Match master', sortOrder: 0, isRequired: false },
      ],
    });

    expect(view.form.controls.items.at(0).value.description).toBe('Color');
    view.removeItem(1);
    view.addItem();
    view.form.controls.items.at(1).patchValue({ description: 'Burrs' });

    view.save();

    expect(updateTemplate).toHaveBeenCalledWith(4, {
      name: 'Visual',
      description: 'Cosmetic',
      partId: 7,
      items: [
        { id: 20, description: 'Color', specification: 'Match master', sortOrder: 0, isRequired: false },
        { description: 'Burrs', specification: undefined, sortOrder: 1, isRequired: true },
      ],
    });
  });
});
