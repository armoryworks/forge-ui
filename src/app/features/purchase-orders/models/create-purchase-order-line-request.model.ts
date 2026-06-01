export interface CreatePurchaseOrderLineRequest {
  partId: number;
  quantity: number;
  unitPrice: number;
  notes?: string;
  /** UoM purchase-units effort — which PartPurchaseUnit (size/form) is ordered (null = per base unit). */
  purchaseUnitId?: number | null;
}
