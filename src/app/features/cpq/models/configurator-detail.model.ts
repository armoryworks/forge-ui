import { ConfiguratorOption } from './configurator-option.model';

/** A configurator with its options, validation rules and pricing formula. */
export interface ConfiguratorDetail {
  id: number;
  name: string;
  description: string | null;
  basePartId: number;
  basePartNumber: string;
  isActive: boolean;
  basePrice: number | null;
  validationRulesJson: string | null;
  pricingFormulaJson: string | null;
  options: ConfiguratorOption[];
  createdAt: string;
  updatedAt: string;
}
