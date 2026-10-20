/** Tabs of the scheduling page; the URL `:tab` segment must be one of these. */
export const SCHEDULING_TABS = ['gantt', 'dispatch', 'work-centers', 'shifts', 'runs'] as const;

export type SchedulingTab = (typeof SCHEDULING_TABS)[number];
