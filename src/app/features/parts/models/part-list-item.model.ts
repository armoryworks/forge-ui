import { InventoryClass } from './inventory-class.type';
import { PartStatus } from './part-status.type';
import { ProcurementSource } from './procurement-source.type';

export interface PartListItem {
  id: number;
  partNumber: string;
  externalPartNumber: string | null;
  /** Short canonical identifier (required). Primary list column. */
  name: string;
  /** Long-form notes (optional). Shown only when present. */
  description: string | null;
  revision: string;
  status: PartStatus;
  // Pillar 1 — three orthogonal axes (legacy single-axis partType retired pre-beta).
  procurementSource: ProcurementSource;
  inventoryClass: InventoryClass;
  bomEntryCount: number;
  createdAt: Date;
  /**
   * Effective sales price as resolved server-side via IPartPricingResolver.
   * Always present; <code>0</code> when {@link effectivePriceSource} is "Default".
   */
  effectivePrice: number;
  effectivePriceCurrency: string;
  effectivePriceSource: 'PriceListEntry' | 'PartPrice' | 'VendorPartTier' | 'Default';
}
