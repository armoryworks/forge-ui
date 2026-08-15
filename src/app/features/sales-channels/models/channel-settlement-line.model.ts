/** One signed component of a payout: income positive, fees and refunds negative. */
export interface ChannelSettlementLine {
  id: number;
  lineType: ChannelSettlementLineType;
  salesOrderId: number | null;
  salesOrderNumber: string | null;
  externalOrderId: string | null;
  amount: number;
  description: string | null;
  postedAt: string | null;
  /** Names an external order we could not resolve — a reconciliation exception. */
  isUnmatched: boolean;
}

export type ChannelSettlementLineType =
  | 'OrderProceeds'
  | 'ShippingIncome'
  | 'TaxCollected'
  | 'ReferralFee'
  | 'FulfillmentFee'
  | 'ShippingLabel'
  | 'Refund'
  | 'ChannelFee'
  | 'ReserveAdjustment'
  | 'Other';
