export interface PurchaseOrderListItem {
  id: number;
  poNumber: string;
  vendorId: number;
  vendorName: string;
  jobId: number | null;
  jobNumber: string | null;
  status: string;
  lineCount: number;
  totalOrdered: number;
  totalReceived: number;
  expectedDeliveryDate: Date | null;
  isBlanket: boolean;
  createdAt: Date;
  // Bought-parts effort PR2.5 — true when the vendor's MinOrderAmount is set
  // and the PO total falls below it. List renders a small warning chip;
  // detail panel renders a full banner with the threshold.
  belowVendorMinimum: boolean;
  // S4b provenance — where the PO came from (Manual | AutoMrp | AutoQuote |
  // ExternalIntegration | Edi), the creating user for Manual POs
  // ("Last, First"), and the free-text reference (suggestion id, RFQ number,
  // provider name).
  originSource: string;
  originUserName: string | null;
  originReference: string | null;
}
