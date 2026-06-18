// Count / set-on-hand: set the absolute on-hand quantity of a part. LocationId is
// optional: omit it in single-location mode and the server uses the default
// location. Gated server-side by CAP-INV-ADJUST (Admin/Manager).
export interface SetOnHandRequest {
  partId: number;
  locationId?: number;
  quantity: number;
  reason: string;
  notes?: string;
  sourcePurchaseOrderId?: number;
  vendorId?: number;
}
