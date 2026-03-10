import { CreatePurchaseOrderLineRequest } from './create-purchase-order-line-request.model';

export interface CreatePurchaseOrderRequest {
  vendorId: number;
  jobId?: number;
  notes?: string;
  lines: CreatePurchaseOrderLineRequest[];
}
