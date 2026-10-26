export interface InvoiceSourceSalesOrder {
  id: number;
  orderNumber: string;
  customerName: string;
  taxRate: number;
  creditTerms?: string | null;
  paymentTermsId?: number | null;
  currencyId?: number | null;
}
