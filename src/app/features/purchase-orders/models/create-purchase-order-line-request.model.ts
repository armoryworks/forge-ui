export interface CreatePurchaseOrderLineRequest {
  partId: number;
  quantity: number;
  unitPrice: number;
  notes?: string;
  /** UoM purchase-options effort — which PartPurchaseOption (size/form) is ordered (null = per base unit). */
  purchaseOptionId?: number | null;
}
