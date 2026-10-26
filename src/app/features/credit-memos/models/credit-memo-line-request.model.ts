export interface CreditMemoLineRequest {
  lineType: string;
  partId?: number | null;
  invoiceLineId?: number | null;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  taxable?: boolean | null;
}
