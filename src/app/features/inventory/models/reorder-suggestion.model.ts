export type ReorderSuggestionStatus = 'Pending' | 'Approved' | 'Dismissed' | 'Expired';

export type ReorderSupplyType = 'Make' | 'Buy';

export interface ReorderSuggestion {
  id: number;
  partId: number;
  partNumber: string;
  partDescription: string;
  vendorId: number | null;
  vendorName: string | null;
  currentStock: number;
  availableStock: number;
  burnRateDailyAvg: number;
  burnRateWindowDays: number;
  daysOfStockRemaining: number | null;
  projectedStockoutDate: string | null;
  incomingPoQuantity: number;
  earliestPoArrival: string | null;
  suggestedQuantity: number;
  supplyType: ReorderSupplyType;
  leadTimeDays: number | null;
  status: ReorderSuggestionStatus;
  approvedByName: string | null;
  approvedAt: string | null;
  resultingPurchaseOrderId: number | null;
  resultingJobId: number | null;
  resultingJobNumber: string | null;
  dismissReason: string | null;
  dismissedByName: string | null;
  dismissedAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface BulkApproveResult {
  approvedCount: number;
  skippedCount: number;
  createdPoIds: number[];
  createdJobIds: number[];
}
