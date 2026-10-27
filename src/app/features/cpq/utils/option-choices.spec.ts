import { describe, it, expect } from 'vitest';

import { ConfiguratorOption } from '../models/configurator-option.model';
import { optionChoices, optionIsActive } from './option-choices';

function option(overrides: Partial<ConfiguratorOption>): ConfiguratorOption {
  return {
    name: 'Color', optionType: 'Select', valuesJson: '[]', pricingRuleJson: null, bomImpactJson: null, routingImpactJson: null,
    dependsOnOptionId: null, sortOrder: 1, isRequired: false, helpText: null, defaultValue: null, ...overrides,
  };
}

describe('optionChoices', () => {
  it('reads plain and labelled values, numeric ranges, and treats broken JSON as any value', () => {
    expect(optionChoices(option({ valuesJson: '["Red", {"value": "Gold", "label": "Gold leaf"}, 3]' })).choices).toEqual([
      { value: 'Red', label: 'Red' }, { value: 'Gold', label: 'Gold leaf' }, { value: '3', label: '3' },
    ]);
    expect(optionChoices(option({ valuesJson: '{"min": 10, "max": 48}' }))).toEqual({ choices: [], min: 10, max: 48 });
    expect(optionChoices(option({ valuesJson: '{oops' }))).toEqual({ choices: [], min: null, max: null });
  });
});

describe('optionIsActive', () => {
  const coating = option({ name: 'Coating', optionType: 'Checkbox' });
  const finish = option({ name: 'Finish', dependsOnOptionId: 'Coating' });
  const gloss = option({ name: 'Gloss level', dependsOnOptionId: 'Finish=Gloss' });
  const all = [coating, finish, gloss];

  it('follows a parent option, and a parent value when one is named', () => {
    expect(optionIsActive(finish, all, { Coating: 'false' })).toBe(false);
    expect(optionIsActive(finish, all, { Coating: 'true' })).toBe(true);
    expect(optionIsActive(gloss, all, { Finish: 'Matte' })).toBe(false);
    expect(optionIsActive(gloss, all, { Finish: 'gloss' })).toBe(true);
    expect(optionIsActive(coating, all, {})).toBe(true);
  });
});
