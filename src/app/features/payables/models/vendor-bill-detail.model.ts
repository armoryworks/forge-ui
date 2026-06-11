import { VendorBillLine } from './vendor-bill-line.model';

// ⚡ ACCOUNTING BOUNDARY — full detail projection of a vendor bill (header + lines).
export interface VendorBillDetail {
  id: number;
  billNumber: string;
  vendorId: number;
  vendorName: string;
  vendorInvoiceNumber: string | null;
  purchaseOrderId: number | null;
  status: string;
  billDate: string;
  dueDate: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  currencyId: number;
  fxRate: number;
  notes: string | null;
  createdAt: string;
  lines: VendorBillLine[];
}
