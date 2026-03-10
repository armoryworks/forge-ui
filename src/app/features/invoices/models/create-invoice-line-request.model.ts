export interface CreateInvoiceLineRequest {
  partId?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}
