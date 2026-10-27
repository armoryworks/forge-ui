/** A purchase order line bought for a sales order line (drop-ship or back-to-back). */
export interface SalesOrderLinePurchase {
  purchaseOrderId: number;
  poNumber: string;
  purchaseOrderLineId: number;
  fulfilmentType: 'DropShip' | 'BackToBack' | 'Standard';
  status: string;
  vendorName: string;
  orderedQuantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
  expectedDeliveryDate: string | null;
}
