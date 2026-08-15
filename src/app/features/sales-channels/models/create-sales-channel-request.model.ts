import { SalesChannelType, TaxCollectedBy } from './sales-channel.model';

export interface CreateSalesChannelRequest {
  name: string;
  code: string;
  description: string | null;
  channelType: SalesChannelType;
  /** Required for retail and marketplace channels — the house account that carries the receivable. */
  soldToCustomerId: number | null;
  /** Omit to take the type's natural default: Marketplace → Marketplace, everything else → Seller. */
  taxCollectedBy: TaxCollectedBy | null;
  orderNumberPrefix: string | null;
  eCommerceIntegrationId: number | null;
}
