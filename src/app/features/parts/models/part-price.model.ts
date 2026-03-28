export interface PartPrice {
  id: number;
  partId: number;
  unitPrice: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
  isCurrent: boolean;
}

export interface AddPartPriceRequest {
  unitPrice: number;
  effectiveFrom?: string; // ISO date — defaults to now on server if omitted
  notes?: string;
}
