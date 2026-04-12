export interface AtpResult {
  partId: number;
  partNumber: string;
  requestedQuantity: number;
  onHand: number;
  allocatedToOrders: number;
  scheduledReceipts: number;
  availableToPromise: number;
  earliestAvailableDate: string | null;
  canFulfill: boolean;
}

export interface AtpBucket {
  date: string;
  cumulativeSupply: number;
  cumulativeDemand: number;
  netAvailable: number;
}
