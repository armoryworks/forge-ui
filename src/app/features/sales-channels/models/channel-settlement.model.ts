/** A marketplace payout batch and its reconciliation state. */
export interface ChannelSettlement {
  id: number;
  channelId: number;
  channelName: string;
  externalSettlementId: string;
  periodStart: string;
  periodEnd: string;
  depositedAt: string | null;
  reportedNetAmount: number;
  /** Sum of the imported components. Equals the reported net when the batch ties out. */
  computedNetAmount: number;
  variance: number;
  currencyCode: string;
  status: ChannelSettlementStatus;
  resolutionNotes: string | null;
  lineCount: number;
  /** Order-linked components whose order could not be resolved. */
  unmatchedLineCount: number;
  createdAt: string;
}

export type ChannelSettlementStatus = 'Imported' | 'Reconciled' | 'Discrepancy' | 'Accepted';
