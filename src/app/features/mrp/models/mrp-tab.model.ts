/** Tabs of the MRP page; the URL `:tab` segment must be one of these. */
export const MRP_TABS = ['dashboard', 'planned-orders', 'exceptions', 'runs', 'master-schedule', 'forecasts'] as const;

export type MrpTab = (typeof MRP_TABS)[number];
