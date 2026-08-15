/**
 * Stored credentials for one storefront or marketplace account.
 *
 * <p>Separate from the channel it feeds: an integration supplies credentials,
 * while the channel decides where the receivable lands and who owes the tax.
 * One integration can be attached to exactly one channel today, but the split
 * is what lets a shop run two Shopify stores as two channels.</p>
 */
export interface ECommerceConnection {
  id: number;
  name: string;
  platform: ECommercePlatform;
  storeUrl: string | null;
  isActive: boolean;
  autoImportOrders: boolean;
  syncInventory: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  orderSyncCount: number;
}

export type ECommercePlatform =
  | 'Shopify'
  | 'WooCommerce'
  | 'BigCommerce'
  | 'Magento'
  | 'Square'
  | 'Amazon'
  | 'Ebay'
  | 'Etsy'
  | 'Walmart'
  | 'Manual';

/** A platform option, annotated with whether a connector for it actually exists. */
export interface ECommercePlatformOption {
  platform: ECommercePlatform;
  name: string;
  isSupported: boolean;
  isMarketplace: boolean;
  /** Why it cannot be used yet. Null when supported. */
  unavailableReason: string | null;
}
