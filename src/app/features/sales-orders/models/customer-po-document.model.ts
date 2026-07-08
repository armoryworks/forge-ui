export interface CustomerPoDocumentLine {
  lineNumber: number;
  description: string;
  partNumber: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

/**
 * Live view of the internal customer-PO document — everything except the
 * identity fields is read from the current sales order at request time.
 */
export interface CustomerPoDocument {
  id: number;
  documentNumber: string;
  generatedAt: string;
  generatedFromQuoteId: number | null;
  quoteNumber: string | null;
  salesOrderId: number;
  orderNumber: string;
  status: string;
  customerPO: string | null;
  customerId: number;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  shippingAddress: string | null;
  billingAddress: string | null;
  lines: CustomerPoDocumentLine[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}
