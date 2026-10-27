/** Body for confirming the quantity a vendor delivered straight to the customer. */
export interface DropShipDeliveryRequest {
  deliveredQuantity: number;
  trackingNumber: string | null;
}
