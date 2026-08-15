import { TaxCollectedBy } from './sales-channel.model';

/**
 * Patch payload. ChannelType is deliberately absent — flipping a live channel
 * between account and retail would retroactively change what its existing
 * orders mean.
 */
export interface UpdateSalesChannelRequest {
  name?: string;
  description?: string | null;
  soldToCustomerId?: number | null;
  taxCollectedBy?: TaxCollectedBy | null;
  orderNumberPrefix?: string | null;
  eCommerceIntegrationId?: number | null;
  isActive?: boolean;
}
