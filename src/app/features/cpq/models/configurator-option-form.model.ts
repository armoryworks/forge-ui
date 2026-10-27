import { FormControl, FormGroup } from '@angular/forms';

import { ConfiguratorOptionType } from './configurator-option-type.type';

/** The editor's form group for one configurator option. */
export type ConfiguratorOptionForm = FormGroup<{
  name: FormControl<string>;
  optionType: FormControl<ConfiguratorOptionType>;
  isRequired: FormControl<boolean>;
  valuesJson: FormControl<string>;
  defaultValue: FormControl<string>;
  dependsOnOptionId: FormControl<string>;
  helpText: FormControl<string>;
  pricingRuleJson: FormControl<string>;
  bomImpactJson: FormControl<string>;
  routingImpactJson: FormControl<string>;
}>;
