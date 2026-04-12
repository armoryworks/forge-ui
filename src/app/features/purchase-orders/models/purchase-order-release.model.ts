export type PurchaseOrderReleaseStatus = 'Open' | 'Sent' | 'PartialReceived' | 'Received' | 'Cancelled';

export interface PurchaseOrderRelease {
  id: number;
  releaseNumber: number;
  purchaseOrderLineId: number;
  partNumber: string;
  partDescription: string;
  quantity: number;
  requestedDeliveryDate: string;
  actualDeliveryDate: string | null;
  status: PurchaseOrderReleaseStatus;
  receivingRecordId: number | null;
  notes: string | null;
  createdAt: string;
}

export interface CreatePurchaseOrderReleaseRequest {
  purchaseOrderLineId: number;
  quantity: number;
  requestedDeliveryDate: string;
  notes?: string;
}

export interface UpdatePurchaseOrderReleaseRequest {
  quantity?: number;
  requestedDeliveryDate?: string;
  actualDeliveryDate?: string;
  status?: PurchaseOrderReleaseStatus;
  notes?: string;
}
