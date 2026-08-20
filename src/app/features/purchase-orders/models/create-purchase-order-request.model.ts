import { CreatePurchaseOrderLineRequest } from './create-purchase-order-line-request.model';

export interface CreatePurchaseOrderRequest {
  vendorId: number;
  jobId?: number;
  notes?: string;
  // Optional manual override for the auto-generated PO number. Only honored
  // server-side when purchase_orders.allow_manual_numbers is enabled; blank
  // (undefined) means auto-generate.
  poNumber?: string;
  lines: CreatePurchaseOrderLineRequest[];
  // Bought-parts effort PR2.5 — landed cost header fields. All optional;
  // when omitted, the server defaults Incoterm + QuoteCurrency from the
  // preferred VendorPart of the first line's part.
  incoterm?: string;
  estimatedFreight?: number;
  quoteCurrency?: string;
}
