import { CreateVendorBillLineRequest } from './create-vendor-bill-line-request.model';

// ⚡ ACCOUNTING BOUNDARY — request to create a Draft vendor bill. Creating a
// Draft is NOT a posting trigger — approval is.
export interface CreateVendorBillRequest {
  vendorId: number;
  vendorInvoiceNumber?: string;
  purchaseOrderId?: number;
  billDate: string;
  dueDate: string;
  taxAmount: number;
  notes?: string;
  currencyId?: number;
  fxRate?: number;
  lines: CreateVendorBillLineRequest[];
}
