import { InventoryClass } from './inventory-class.type';
import { ProcurementSource } from './procurement-source.type';

export interface CreatePartRequest {
  /** Required short identifier. */
  name: string;
  /** Optional long-form notes. */
  description?: string;
  revision?: string;
  // Pillar 1 — Three orthogonal axes replace the legacy single-axis partType
  // (retired pre-beta). procurementSource + inventoryClass are required;
  // itemKindId is an optional descriptive tag that can flow through later.
  procurementSource: ProcurementSource;
  inventoryClass: InventoryClass;
  materialSpecId?: number;
}
