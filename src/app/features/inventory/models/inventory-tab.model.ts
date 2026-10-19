/** Tabs of the detailed inventory page; the URL `:tab` segment must be one of these. */
export const INVENTORY_TABS = ['stock', 'locations', 'movements', 'receiving', 'inspection', 'stockOps', 'cycleCounts', 'reservations', 'replenishment', 'uom'] as const;

export type InventoryTab = (typeof INVENTORY_TABS)[number];
