/** Shape returned by the retail-order create endpoint (the shared sales-order list item). */
export interface RetailOrderCreated {
  id: number;
  orderNumber: string;
  customerId: number;
  customerName: string;
  status: string;
  customerPO: string | null;
  lineCount: number;
  total: number;
  requestedDeliveryDate: string | null;
  createdAt: string;
  salesOrderId: number | null;
  jobId: number | null;
}
