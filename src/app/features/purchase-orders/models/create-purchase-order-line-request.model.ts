export interface CreatePurchaseOrderLineRequest {
  partId: number;
  quantity: number;
  unitPrice: number;
  notes?: string;
  /** Optional reason supplied when the unit price was manually overridden. */
  manualOverrideReason?: string;
  /** UoM purchase-units effort — which PartPurchaseUnit (size/form) is ordered (null = per base unit). */
  purchaseUnitId?: number | null;
}
