// Friendly stock-in (no purchase order). LocationId is optional: omit it in
// single-location mode and the server uses the default location.
export interface ReceiveStockRequest {
  partId: number;
  locationId?: number;
  quantity: number;
  reason?: string;
  notes?: string;
  lotNumber?: string;
}
