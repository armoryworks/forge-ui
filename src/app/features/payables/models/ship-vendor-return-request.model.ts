export interface ShipVendorReturnRequest {
  shipDate: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  rmaNumber: string | null;
  notes: string | null;
}
