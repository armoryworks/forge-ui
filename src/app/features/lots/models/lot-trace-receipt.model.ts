export interface LotTraceReceipt {
  receivingRecordId: number;
  receiptNumber: string | null;
  purchaseOrderId: number;
  poNumber: string;
  vendorId: number;
  vendorName: string;
  receivedAt: Date;
  quantity: number;
  inspectionStatus: string;
}
