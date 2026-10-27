import { MrpOrderType } from './mrp.model';

export interface MrpReleaseResult {
  plannedOrderId: number;
  orderType: MrpOrderType;
  createdPurchaseOrderId: number | null;
  createdJobId: number | null;
}
