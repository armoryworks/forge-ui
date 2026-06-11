// ⚡ ACCOUNTING BOUNDARY — AP counterpart of InvoiceListItem.
export interface VendorBillListItem {
  id: number;
  billNumber: string;
  vendorId: number;
  vendorName: string;
  vendorInvoiceNumber: string | null;
  status: string;
  billDate: string;
  dueDate: string;
  total: number;
  amountPaid: number;
  balanceDue: number;
  createdAt: string;
  /** True when any payment applied to this bill has a failed latest bank transmission. */
  hasFailedTransmission: boolean;
}
