export interface PurchaseOrderLine {
  id: number;
  partId: number;
  partNumber: string;
  description: string;
  orderedQuantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
  // Phase 3 / WU-14 / H3 — qty marked cancelled-not-received at short-close time.
  cancelledShortCloseQuantity: number;
  unitPrice: number;
  lineTotal: number;
  notes: string | null;
  /** UoM purchase-units effort — the ordered size/form (null = per base unit). */
  purchaseUnitId: number | null;
  purchaseUnitLabel: string | null;
}
