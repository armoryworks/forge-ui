/** Route to market. ChannelType is what the order pipeline branches on. */
export interface SalesChannel {
  id: number;
  name: string;
  code: string;
  description: string | null;
  channelType: SalesChannelType;
  soldToCustomerId: number | null;
  soldToCustomerName: string | null;
  taxCollectedBy: TaxCollectedBy;
  isDefault: boolean;
  isActive: boolean;
  orderNumberPrefix: string | null;
  eCommerceIntegrationId: number | null;
  /** True for DirectRetail and Marketplace — gates the buyer/settlement surfaces. */
  isRetail: boolean;
  orderCount: number;
  listingCount: number;
  createdAt: string;
}

export type SalesChannelType = 'DirectB2B' | 'DirectRetail' | 'Marketplace';

/**
 * Who collected the sales tax, and therefore who owes it. `Marketplace` means a
 * facilitator collects and remits — the amount is on the document because the
 * buyer paid it, but it is never our liability.
 */
export type TaxCollectedBy = 'Seller' | 'Marketplace';
