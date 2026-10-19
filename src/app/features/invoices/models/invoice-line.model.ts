export interface InvoiceLine {
  id: number;
  partId: number | null;
  partNumber: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  lineNumber: number;
  taxable: boolean;
  notes: string | null;
}
