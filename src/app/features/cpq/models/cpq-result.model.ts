import { CpqBomLine } from './cpq-bom-line.model';
import { CpqPriceLine } from './cpq-price-line.model';
import { CpqRoutingLine } from './cpq-routing-line.model';

/** What a set of selections comes to: the unit price in the functional currency, its breakdown and the errors. */
export interface CpqResult {
  computedPrice: number;
  quantity: number;
  extendedPrice: number;
  leadTimeDays: number;
  priceBreakdown: CpqPriceLine[];
  bomPreview: CpqBomLine[];
  routingPreview: CpqRoutingLine[];
  validationErrors: string[];
  isValid: boolean;
}
