import { PRIORITIES, PRIORITY_STYLES } from '../../../shared/models/priority.const';

/**
 * Priority → color map, DERIVED from the canonical PRIORITY_STYLES source of truth
 * (shared/models/priority.const.ts) so colors can never drift from the shared
 * PriorityIndicatorComponent. Kept as a `Record<string, string>` with the same
 * shape existing importers rely on.
 */
export const PRIORITY_COLORS: Record<string, string> = Object.fromEntries(
  PRIORITIES.map(p => [p, PRIORITY_STYLES[p].color]),
);
