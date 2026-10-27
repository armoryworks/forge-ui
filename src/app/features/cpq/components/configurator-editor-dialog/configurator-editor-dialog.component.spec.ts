import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormArray, FormGroup } from '@angular/forms';

import { of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { ConfiguratorDetail } from '../../models/configurator-detail.model';
import { ConfiguratorOptionForm } from '../../models/configurator-option-form.model';
import { CpqService } from '../../services/cpq.service';
import { ConfiguratorEditorDialogComponent } from './configurator-editor-dialog.component';

interface EditorInternals {
  ngOnInit(): void;
  form: FormGroup;
  options: FormArray<ConfiguratorOptionForm>;
  addOption(): void;
  moveOption(index: number, delta: number): void;
  save(): void;
}

const DETAIL: ConfiguratorDetail = {
  id: 3, name: 'Bracket builder', description: null, basePartId: 10, basePartNumber: 'BRK-100', isActive: true, basePrice: 100,
  validationRulesJson: null, pricingFormulaJson: '{"expression":"quantity * 2"}', createdAt: '', updatedAt: '',
  options: [
    { id: 1, name: 'Color', optionType: 'Select', valuesJson: '["Red"]', pricingRuleJson: null, bomImpactJson: null, routingImpactJson: null,
      dependsOnOptionId: null, sortOrder: 10, isRequired: true, helpText: null, defaultValue: null },
  ],
};

function create(canEdit: boolean, configuratorId: number | null, service: Record<string, unknown>): EditorInternals {
  TestBed.configureTestingModule({
    providers: [
      { provide: CpqService, useValue: { getConfigurator: () => of(DETAIL), ...service } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
      { provide: SnackbarService, useValue: { success: vi.fn() } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new ConfiguratorEditorDialogComponent());
  mockSignalInputs(component, { configuratorId, canEdit });
  const editor = component as unknown as EditorInternals;
  editor.ngOnInit();
  return editor;
}

describe('ConfiguratorEditorDialogComponent', () => {
  it('loads a configurator, shows the formula as text and saves it back wrapped, with options in their new order', () => {
    const updateConfigurator = vi.fn(() => of(undefined));
    const editor = create(true, 3, { updateConfigurator });
    expect(editor.form.get('pricingFormula')?.value).toBe('quantity * 2');

    editor.addOption();
    editor.options.at(1).patchValue({ name: 'Coating', optionType: 'Checkbox', valuesJson: '' });
    editor.moveOption(1, -1);
    editor.save();

    expect(updateConfigurator).toHaveBeenCalledWith(3, expect.objectContaining({
      name: 'Bracket builder',
      basePartId: 10,
      pricingFormulaJson: '{"expression":"quantity * 2"}',
      options: [
        expect.objectContaining({ name: 'Coating', optionType: 'Checkbox', valuesJson: '[]', sortOrder: 10 }),
        expect.objectContaining({ name: 'Color', sortOrder: 20, isRequired: true }),
      ],
    }));
  });

  it('refuses JSON that does not parse', () => {
    const editor = create(true, null, { createConfigurator: vi.fn() });
    editor.form.patchValue({ name: 'New', basePartId: 4 });
    editor.options.at(0).patchValue({ name: 'Size', pricingRuleJson: '{oops' });
    expect(editor.form.invalid).toBe(true);
  });

  it('is read-only for a role that may configure but not author', () => {
    const updateConfigurator = vi.fn();
    const editor = create(false, 3, { updateConfigurator });
    expect(editor.form.disabled).toBe(true);
    editor.save();
    expect(updateConfigurator).not.toHaveBeenCalled();
  });
});
