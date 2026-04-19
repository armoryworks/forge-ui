export interface AutoPoSuggestion {
  id: number;
  partId: number;
  partNumber: string;
  partDescription: string | null;
  vendorId: number;
  vendorName: string;
  suggestedQty: number;
  neededByDate: string;
  status: AutoPoSuggestionStatus;
  sourceSalesOrderNumbers: string[] | null;
  createdAt: string;
}

export type AutoPoSuggestionStatus = 'Pending' | 'Converted' | 'Dismissed';
