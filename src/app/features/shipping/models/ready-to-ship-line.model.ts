/** Shipping workspace: an open sales-order line with quantity remaining to ship. */
export interface ReadyToShipLine {
  salesOrderLineId: number;
  lineNumber: number;
  description: string;
  partId: number | null;
  partNumber: string | null;
  quantity: number;
  shippedQuantity: number;
  remainingQuantity: number;
}
