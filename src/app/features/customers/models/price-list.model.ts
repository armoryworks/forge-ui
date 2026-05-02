/**
 * Customer-scoped or default price list (parent record).
 * Mirrors the .NET `PriceListListItemModel` / `PriceListResponseModel` shape.
 */
export interface PriceList {
  id: number;
  name: string;
  description: string | null;
  customerId: number | null;
  customerName?: string | null;
  isDefault: boolean;
  isActive: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  entryCount?: number;
  createdAt?: string;
}

/**
 * A row inside a price list — one part-tier-currency price record.
 * Mirrors the .NET `PriceListEntryResponseModel` shape.
 */
export interface PriceListEntry {
  id: number;
  priceListId: number;
  partId: number;
  partNumber: string;
  partName: string;
  unitPrice: number;
  minQuantity: number;
  currency: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Body for `POST /api/v1/price-lists/{id}/entries`. */
export interface CreatePriceListEntryRequest {
  partId: number;
  unitPrice: number;
  minQuantity: number;
  currency: string;
  notes: string | null;
}

/**
 * Body for `PUT /api/v1/price-list-entries/{id}`. PartId is intentionally
 * absent — see server-side comment for rationale.
 */
export interface UpdatePriceListEntryRequest {
  unitPrice: number;
  minQuantity: number;
  currency: string;
  notes: string | null;
}
