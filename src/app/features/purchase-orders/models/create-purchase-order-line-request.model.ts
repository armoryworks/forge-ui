export interface CreatePurchaseOrderLineRequest {
  partId: number | null;
  /** Required when partId is null: the line is a service or non-stock item described in words. */
  description?: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
  /** Optional reason supplied when the unit price was manually overridden. */
  manualOverrideReason?: string;
  /** UoM purchase-units effort — which PartPurchaseUnit (size/form) is ordered (null = per base unit). */
  purchaseUnitId?: number | null;
}
