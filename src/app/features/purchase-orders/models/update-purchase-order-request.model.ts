export interface UpdatePurchaseOrderRequest {
  notes?: string;
  expectedDeliveryDate?: string;
  // Rename the PO number. Server accepts it only while the PO is in Draft and
  // purchase_orders.allow_manual_numbers is enabled; blank (undefined) leaves
  // it unchanged.
  poNumber?: string;
  // Bought-parts effort PR2.5 — landed cost header fields. Editable while
  // the PO is in Draft only; once Submitted, the FX snapshot is locked.
  incoterm?: string;
  estimatedFreight?: number;
  quoteCurrency?: string;
  fxRate?: number;
  fxRateSource?: string;
}
