export interface ShipmentPackage {
  id: number;
  shipmentId: number;
  trackingNumber: string | null;
  carrier: string | null;
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  status: string;
}
