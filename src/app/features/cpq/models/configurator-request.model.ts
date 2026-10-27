import { ConfiguratorOption } from './configurator-option.model';

/** Body for creating or updating a configurator. The option list replaces the stored one. */
export interface ConfiguratorRequest {
  name: string;
  description: string | null;
  basePartId: number;
  basePrice: number | null;
  isActive: boolean;
  validationRulesJson: string | null;
  pricingFormulaJson: string | null;
  options: ConfiguratorOption[];
}
