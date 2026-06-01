// UoM purchase-units effort — a part's purchasable size/form (4×8 sheet, 1 kg bar, bag of 100).
// Content quantity is in the part's base/stock UoM; vendors price these via the price-tier surface.
export interface PartPurchaseUnit {
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

export interface CreatePartPurchaseUnitRequest {
  label: string;
  contentQuantity: number;
  contentUomId: number | null;
  sortOrder: number;
}

export interface UpdatePartPurchaseUnitRequest {
  label: string;
  contentQuantity: number;
  contentUomId: number | null;
  sortOrder: number;
  isActive: boolean;
}
