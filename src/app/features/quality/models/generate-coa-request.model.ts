export interface GenerateCoaRequest {
  lotId: number;
  customerId?: number | null;
  shipmentId?: number | null;
  language?: string | null;
  notes?: string | null;
}
