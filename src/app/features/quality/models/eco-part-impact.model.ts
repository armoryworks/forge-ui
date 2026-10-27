import { EcoImpactJob } from './eco-impact-job.model';
import { EcoImpactPurchaseOrderLine } from './eco-impact-purchase-order-line.model';
import { EcoImpactSalesOrderLine } from './eco-impact-sales-order-line.model';
import { EcoImpactStock } from './eco-impact-stock.model';

export interface EcoPartImpact {
  partId: number;
  partNumber: string;
  partName: string | null;
  currentRevision: string;
  openJobs: EcoImpactJob[];
  openPurchaseOrderLines: EcoImpactPurchaseOrderLine[];
  openSalesOrderLines: EcoImpactSalesOrderLine[];
  stockByRevision: EcoImpactStock[];
}
