import { DocumentLineType } from '../../../shared/models/document-line-type.type';
import { SalesOrderLineJob } from './sales-order-line-job.model';
import { SalesOrderLinePurchase } from './sales-order-line-purchase.model';

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
  needsJob: boolean;
  shipsGoods?: boolean;
  lineType?: DocumentLineType;
  taxable?: boolean;
  purchases?: SalesOrderLinePurchase[];
}
