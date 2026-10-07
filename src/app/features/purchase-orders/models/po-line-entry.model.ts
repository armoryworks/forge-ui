export interface PoLineEntry {
  partId: number | null;
  partNumber: string | null;
  description: string;
  orderedQuantity: number;
  unitPrice: number;
  purchaseUnitId: number | null;
  purchaseUnitLabel: string | null;
  notes?: string | null;
  /** Reason supplied when the unit price was manually overridden. */
  overrideReason?: string | null;
}
