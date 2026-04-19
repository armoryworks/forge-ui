export interface SalesOrderShipment {
  id: number;
  shipmentNumber: string;
  status: string;
  carrier: string | null;
  trackingNumber: string | null;
  shippedDate: Date | null;
  deliveredDate: Date | null;
  shippingCost: number;
  weight: number | null;
  notes: string | null;
  lines: SalesOrderShipmentLine[];
  packages: SalesOrderShipmentPackage[];
}

export interface SalesOrderShipmentLine {
  id: number;
  partId: number | null;
  partNumber: string | null;
  quantity: number;
  notes: string | null;
  salesOrderLineId: number | null;
}

export interface SalesOrderShipmentPackage {
  id: number;
  trackingNumber: string | null;
  carrier: string | null;
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  status: string | null;
}
