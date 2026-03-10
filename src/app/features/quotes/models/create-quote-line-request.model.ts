export interface CreateQuoteLineRequest {
  partId?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}
