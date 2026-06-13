export interface PurchaseOrderLine {
  id: number;
  partId: number;
  partNumber: string;
  description: string;
  orderedQuantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
  /** AP 3-way match — received − billed = max quantity still billable on this line. */
  unbilledReceivedQuantity: number;
  // Phase 3 / WU-14 / H3 — qty marked cancelled-not-received at short-close time.
  cancelledShortCloseQuantity: number;
  unitPrice: number;
  lineTotal: number;
  notes: string | null;
  /** UoM purchase-units effort — the ordered size/form (null = per base unit). */
  purchaseUnitId: number | null;
  purchaseUnitLabel: string | null;
  /** Reason captured when the unit price was manually overridden (null otherwise). */
  manualOverrideReason: string | null;
}
