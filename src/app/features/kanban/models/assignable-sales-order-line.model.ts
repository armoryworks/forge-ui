/**
 * #27 — a sales-order line offered for inline association when creating a job.
 * `assignedJobCount` is how many open jobs are already linked to the line; the
 * picker hides lines with a positive count unless the "show assigned" override is on.
 */
export interface AssignableSalesOrderLine {
  id: number;
  salesOrderId: number;
  orderNumber: string;
  lineNumber: number;
  partId: number | null;
  partNumber: string | null;
  description: string;
  quantity: number;
  assignedJobCount: number;
}
