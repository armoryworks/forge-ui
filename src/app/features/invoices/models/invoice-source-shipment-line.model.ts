export interface InvoiceSourceShipmentLine {
  partId: number | null;
  partNumber: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  taxable: boolean;
}
