/** Tabs of the quality page; the URL `:tab` segment must be one of these (or `lots`, which moves to the Lots page). */
export const QUALITY_TABS = ['inspections', 'templates', 'spc-charts', 'spc-data', 'spc-ooc', 'ncrs', 'capas', 'ecos', 'gages'] as const;

export type QualityTab = (typeof QUALITY_TABS)[number];
