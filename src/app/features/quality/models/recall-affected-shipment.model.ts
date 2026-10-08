export interface RecallAffectedShipment {
  shipmentId: number;
  shipmentNumber: string;
  customerId: number;
  customerName: string;
  affectedQuantity: number;
  shippedDate: Date | null;
  trackingNumber: string | null;
  isApproximate: boolean;
}
