/** Phase 1r / Batch 16 — pre-quote sample part tracking lifecycle. */
export type SampleShipmentStatus =
  | 'Requested' | 'Approved' | 'Shipped' | 'Delivered'
  | 'QuotedFromSample' | 'LostFromSample' | 'Stale';

export interface SampleShipment {
  id: number;
  leadId: number;
  partId: number | null;
  partDescription: string | null;
  quantity: number;
  status: SampleShipmentStatus;
  requestedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  costToUs: number | null;
  chargedAmount: number | null;
  trackingNumber: string | null;
  carrier: string | null;
  notes: string | null;
  createdAt: string;
}

export interface CreateSampleShipmentRequest {
  leadId: number;
  partId?: number | null;
  partDescription?: string | null;
  quantity: number;
  notes?: string | null;
}

export interface UpdateSampleShipmentRequest {
  partId?: number | null;
  partDescription?: string | null;
  quantity: number;
  status: SampleShipmentStatus;
  requestedAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  costToUs?: number | null;
  chargedAmount?: number | null;
  trackingNumber?: string | null;
  carrier?: string | null;
  notes?: string | null;
}
