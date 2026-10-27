/** One returnable line of a channel order. */
export interface ChannelReturnOrderLine {
  id: number;
  lineNumber: number;
  partNumber: string | null;
  description: string;
  quantity: number;
  shippedQuantity: number;
  unitPrice: number;
}
