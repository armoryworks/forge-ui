/** Tabs of the Watchtower page; the URL `:tab` segment must be one of these. */
export const WATCHTOWER_TABS = ['proposals', 'sources'] as const;

export type WatchtowerTab = (typeof WATCHTOWER_TABS)[number];
