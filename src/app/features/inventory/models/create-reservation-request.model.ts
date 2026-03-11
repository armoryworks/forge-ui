export interface CreateReservationRequest {
  partId: number;
  binContentId: number;
  jobId?: number;
  salesOrderLineId?: number;
  quantity: number;
  notes?: string;
}
