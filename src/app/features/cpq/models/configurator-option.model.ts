import { ConfiguratorOptionType } from './configurator-option-type.type';

/** One option of a configurator, with its admin-authored JSON rules (see the API's ProductConfigurator docs). */
export interface ConfiguratorOption {
  id?: number;
  name: string;
  optionType: ConfiguratorOptionType;
  valuesJson: string;
  pricingRuleJson: string | null;
  bomImpactJson: string | null;
  routingImpactJson: string | null;
  dependsOnOptionId: string | null;
  sortOrder: number;
  isRequired: boolean;
  helpText: string | null;
  defaultValue: string | null;
}
