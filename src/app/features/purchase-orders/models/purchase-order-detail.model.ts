import { PurchaseOrderLine } from './purchase-order-line.model';

export interface PurchaseOrderDetail {
  id: number;
  poNumber: string;
  vendorId: number;
  vendorName: string;
  jobId: number | null;
  jobNumber: string | null;
  status: string;
  submittedDate: string | null;
  acknowledgedDate: string | null;
  expectedDeliveryDate: string | null;
  receivedDate: string | null;
  notes: string | null;
  lines: PurchaseOrderLine[];
  createdAt: string;
  updatedAt: string;
}
