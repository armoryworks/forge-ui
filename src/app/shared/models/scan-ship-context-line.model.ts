export interface ScanShipContextLine {
  shipmentLineId: number;
  shipmentId: number;
  shipmentNumber: string;
  salesOrderNumber: string | null;
  requiredQuantity: number;
}
