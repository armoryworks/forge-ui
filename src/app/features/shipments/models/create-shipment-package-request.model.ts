export interface CreateShipmentPackageRequest {
  trackingNumber?: string;
  carrier?: string;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
}
