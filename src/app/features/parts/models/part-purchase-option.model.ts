// UoM purchase-options effort — a part's purchasable size/form (4×8 sheet, 1 kg bar, bag of 100).
// Content quantity is in the part's base/stock UoM; vendors price these via the price-tier surface.
export interface PartPurchaseOption {
  id: number;
  partId: number;
  label: string;
  contentQuantity: number;
  contentUomId: number | null;
  contentUomCode: string | null;
  contentUomLabel: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface CreatePartPurchaseOptionRequest {
  label: string;
  contentQuantity: number;
  contentUomId: number | null;
  sortOrder: number;
}

export interface UpdatePartPurchaseOptionRequest {
  label: string;
  contentQuantity: number;
  contentUomId: number | null;
  sortOrder: number;
  isActive: boolean;
}
