/** Tabs of the costing page; the URL `:tab` segment must be one of these. */
export const COSTING_TABS = ['periods', 'cost-centers', 'pools', 'templates'] as const;

export type CostingTab = (typeof COSTING_TABS)[number];
