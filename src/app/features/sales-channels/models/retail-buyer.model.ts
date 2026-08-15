/** A consumer who bought through a retail or marketplace channel. */
export interface RetailBuyer {
  id: number;
  channelId: number;
  channelName: string;
  externalBuyerId: string;
  displayName: string;
  contactEmail: string | null;
  phone: string | null;
  marketingConsent: boolean;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  orderCount: number;
  purgeAfter: string | null;
  /** Set once PII was scrubbed. The row keeps its orders and totals. */
  purgedAt: string | null;
  lifetimeValue: number;
}
