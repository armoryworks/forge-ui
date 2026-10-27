import { describe, it, expect, vi, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormRecord } from '@angular/forms';
import { Signal } from '@angular/core';

import { of } from 'rxjs';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { ConfiguratorDetail } from '../../models/configurator-detail.model';
import { CpqResult } from '../../models/cpq-result.model';
import { CpqSelection } from '../../models/cpq-selection.model';
import { CpqService } from '../../services/cpq.service';
import { ConfiguratorFormComponent } from './configurator-form.component';

interface FormInternals {
  ngOnInit(): void;
  form: FormRecord<FormControl<unknown>>;
  quantity: FormControl<number | null>;
  visibleFields: Signal<{ option: { name: string } }[]>;
  result: Signal<CpqResult | null>;
}

const DETAIL: ConfiguratorDetail = {
  id: 3, name: 'Bracket builder', description: null, basePartId: 10, basePartNumber: 'BRK-100', isActive: true, basePrice: 100,
  validationRulesJson: null, pricingFormulaJson: null, createdAt: '', updatedAt: '',
  options: [
    { name: 'Color', optionType: 'Select', valuesJson: '["Red","Gold"]', pricingRuleJson: null, bomImpactJson: null, routingImpactJson: null,
      dependsOnOptionId: null, sortOrder: 1, isRequired: true, helpText: null, defaultValue: 'Red' },
    { name: 'Coating', optionType: 'Checkbox', valuesJson: '[]', pricingRuleJson: null, bomImpactJson: null, routingImpactJson: null,
      dependsOnOptionId: null, sortOrder: 2, isRequired: false, helpText: null, defaultValue: null },
    { name: 'Finish', optionType: 'Select', valuesJson: '["Matte","Gloss"]', pricingRuleJson: null, bomImpactJson: null, routingImpactJson: null,
      dependsOnOptionId: 'Coating', sortOrder: 3, isRequired: false, helpText: null, defaultValue: 'Gloss' },
  ],
};

const RESULT = { computedPrice: 120, quantity: 2, extendedPrice: 240, leadTimeDays: 0, priceBreakdown: [], bomPreview: [], routingPreview: [], validationErrors: [], isValid: true } as CpqResult;

describe('ConfiguratorFormComponent', () => {
  afterEach(() => vi.useRealTimers());

  it('builds a control per option, hides options whose dependency is off and prices the visible selections', () => {
    vi.useFakeTimers();
    const configure = vi.fn(() => of(RESULT));
    TestBed.configureTestingModule({ providers: [{ provide: CpqService, useValue: { configure } }] });
    const component = TestBed.runInInjectionContext(() => new ConfiguratorFormComponent());
    mockSignalInputs(component, { configurator: DETAIL });
    const selections: CpqSelection[] = [];
    component.selectionChange.subscribe(s => selections.push(s));
    const form = component as unknown as FormInternals;
    form.ngOnInit();

    expect(Object.keys(form.form.controls)).toEqual(['Color', 'Coating', 'Finish']);
    expect(form.visibleFields().map(f => f.option.name)).toEqual(['Color', 'Coating']);

    form.quantity.setValue(2);
    vi.advanceTimersByTime(300);
    expect(configure).toHaveBeenLastCalledWith(3, { Color: 'Red', Coating: 'false' }, 2);
    expect(form.result()).toBe(RESULT);

    form.form.controls['Coating'].setValue(true);
    vi.advanceTimersByTime(300);
    expect(configure).toHaveBeenLastCalledWith(3, { Color: 'Red', Coating: 'true', Finish: 'Gloss' }, 2);
    expect(selections.at(-1)).toEqual({ selections: { Color: 'Red', Coating: 'true', Finish: 'Gloss' }, quantity: 2 });
  });
});
