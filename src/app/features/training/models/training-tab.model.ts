/** Tabs of the training page, in tab-bar order; the URL `:tab` segment must be one of these. */
export const TRAINING_TABS = ['my-learning', 'paths', 'all-modules'] as const;

export type TrainingTab = (typeof TRAINING_TABS)[number];
