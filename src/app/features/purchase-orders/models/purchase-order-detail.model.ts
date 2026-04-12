import { PurchaseOrderLine } from './purchase-order-line.model';

export interface PurchaseOrderDetail {
  id: number;
  poNumber: string;
  vendorId: number;
  vendorName: string;
  jobId: number | null;
  jobNumber: string | null;
  status: string;
  submittedDate: Date | null;
  acknowledgedDate: Date | null;
  expectedDeliveryDate: Date | null;
  receivedDate: Date | null;
  notes: string | null;
  isBlanket: boolean;
  blanketTotalQuantity: number | null;
  blanketReleasedQuantity: number | null;
  blanketRemainingQuantity: number | null;
  blanketExpirationDate: Date | null;
  agreedUnitPrice: number | null;
  lines: PurchaseOrderLine[];
  createdAt: Date;
  updatedAt: Date;
}
