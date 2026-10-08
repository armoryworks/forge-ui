import { SubcontractStatus } from './subcontract-status.type';

export interface SubcontractOrder {
  id: number;
  jobId: number;
  jobNumber: string;
  operationId: number;
  operationName: string;
  vendorId: number;
  vendorName: string;
  purchaseOrderId: number | null;
  poNumber: string | null;
  quantity: number;
  unitCost: number;
  totalCost: number;
  sentAt: string;
  expectedReturnDate: string | null;
  receivedAt: string | null;
  receivedQuantity: number | null;
  status: SubcontractStatus;
  shippingTrackingNumber: string | null;
  returnTrackingNumber: string | null;
  notes: string | null;
  createdAt: string;
}
