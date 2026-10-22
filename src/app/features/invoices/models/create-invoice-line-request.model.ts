export interface CreateInvoiceLineRequest {
  partId?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  taxable: boolean;
  notes?: string;
  salesOrderLineId?: number;
}
