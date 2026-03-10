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
  expectedDeliveryDate: string | null;
  createdAt: string;
}
