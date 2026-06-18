// Friendly stock-out (no shipment or job issue). LocationId is optional: omit it
// in single-location mode and the server uses the default location.
export interface UseStockRequest {
  partId: number;
  locationId?: number;
  quantity: number;
  reason?: string;
  notes?: string;
}
