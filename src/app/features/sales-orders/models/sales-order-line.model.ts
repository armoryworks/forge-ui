import { SalesOrderLineJob } from './sales-order-line-job.model';

export interface SalesOrderLine {
  id: number;
  partId: number | null;
  partNumber: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  lineNumber: number;
  shippedQuantity: number;
  remainingQuantity: number;
  isFullyShipped: boolean;
  notes: string | null;
  jobs: SalesOrderLineJob[];
}
