export interface ReservableSalesOrderLine {
  salesOrderLineId: number;
  salesOrderId: number;
  salesOrderNumber: string;
  lineNumber: number;
  customerName: string;
  openQuantity: number;
  reservedQuantity: number;
  requestedDeliveryDate: string | null;
}
