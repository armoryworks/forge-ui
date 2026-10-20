/** Tabs of the purchase orders page; the URL `:tab` segment must be one of these. */
export const PURCHASE_ORDERS_TABS = ['orders', 'suggestions', 'settings'] as const;

export type PurchaseOrdersTab = (typeof PURCHASE_ORDERS_TABS)[number];
