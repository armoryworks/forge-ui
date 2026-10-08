/**
 * Row model for the sales-orders list: one row per sales order, so `id` is the
 * SalesOrder id and opens the order detail at /orders/{id}.
 */
export interface SalesOrderListItem {
  id: number;
  orderNumber: string;
  customerId: number;
  customerName: string;
  status: string;
  customerPO: string | null;
  lineCount: number;
  total: number;
  requestedDeliveryDate: Date | null;
  createdAt: Date;
  salesOrderId: number | null;
  jobId: number | null;
}
