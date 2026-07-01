import { SelectOption } from '../components/select/select.component';

export const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'] as const;

export const PRIORITY_OPTIONS: SelectOption[] = PRIORITIES.map(p => ({ value: p, label: p }));

export const PRIORITY_FILTER_OPTIONS: SelectOption[] = [
  { value: null, label: 'All Priorities' },
  ...PRIORITY_OPTIONS,
];

export type PriorityName = 'Low' | 'Normal' | 'High' | 'Urgent';

export type PriorityShape = 'circle' | 'square' | 'triangle' | 'diamond';

export interface PriorityStyle {
  color: string;
  shape: PriorityShape;
}

/**
 * Canonical, colorblind-safe styling for each JobPriority. Colors MUST match the
 * legacy PRIORITY_COLORS map (kanban/models/priority-colors.const.ts re-derives
 * itself from here so the two can't drift). Each priority also maps to a distinct
 * SHAPE so meaning is conveyed by more than color alone (WCAG 2.2 AA).
 */
export const PRIORITY_STYLES: Record<PriorityName, PriorityStyle> = {
  Low: { color: '#94a3b8', shape: 'circle' },
  Normal: { color: '#0d9488', shape: 'square' },
  High: { color: '#f59e0b', shape: 'triangle' },
  Urgent: { color: '#dc2626', shape: 'diamond' },
};

/** Resolve a priority name (case-sensitive enum value) to its style, defaulting to Normal. */
export function priorityStyle(p: string | null | undefined): PriorityStyle {
  return PRIORITY_STYLES[p as PriorityName] ?? PRIORITY_STYLES.Normal;
}
