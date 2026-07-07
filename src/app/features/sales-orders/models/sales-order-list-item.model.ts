/**
 * Row model for the sales-orders list. The list merges two backend sources:
 * Draft rows project from the SalesOrder entity while confirmed/production
 * rows project from the Job read model, so `id` is only a row identity
 * (paging/trackBy) — it is a SalesOrder id for Draft rows but a Job id for
 * Job-projected rows. Use `salesOrderId` to open the sales-order detail and
 * `jobId` to open the job detail; exactly one drives each row's click-through.
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
