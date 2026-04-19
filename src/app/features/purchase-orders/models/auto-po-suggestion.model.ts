export type AutoPoSuggestionStatus = 'Pending' | 'Converted' | 'Dismissed';

export interface AutoPoSuggestion {
  id: number;
  partId: number;
  partNumber: string;
  partDescription: string;
  vendorId: number;
  vendorName: string;
  suggestedQty: number;
  neededByDate: string;
  sourceSalesOrderIds: number[];
  status: AutoPoSuggestionStatus;
  convertedPurchaseOrderId: number | null;
  createdAt: string;
}
