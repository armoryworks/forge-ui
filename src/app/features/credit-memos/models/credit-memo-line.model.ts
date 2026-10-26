export interface CreditMemoLine {
  id: number;
  lineNumber: number;
  lineType: string;
  partId: number | null;
  partNumber: string | null;
  invoiceLineId: number | null;
  description: string;
  quantity: number;
  unitPrice: number;
  taxable: boolean;
  lineTotal: number;
}
