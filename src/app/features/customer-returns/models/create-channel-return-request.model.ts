export interface CreateChannelReturnRequest {
  salesOrderId: number;
  salesOrderLineId?: number | null;
  externalRmaId?: string | null;
  reason: string;
  notes?: string | null;
  quantity?: number | null;
  refundAmount?: number | null;
  returnDate?: string | null;
}
