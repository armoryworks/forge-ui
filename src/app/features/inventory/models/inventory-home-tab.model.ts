/** Tabs of the standalone-inventory home; the URL `:tab` segment must be one of these. */
export const INVENTORY_HOME_TABS = ['kiosk', 'tasks', 'dashboard'] as const;

export type InventoryHomeTab = (typeof INVENTORY_HOME_TABS)[number];
