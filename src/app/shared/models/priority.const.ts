import { SelectOption } from '../components/select/select.component';

export const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'] as const;

export const PRIORITY_OPTIONS: SelectOption[] = PRIORITIES.map(p => ({ value: p, label: p }));

export const PRIORITY_FILTER_OPTIONS: SelectOption[] = [
  { value: null, label: 'All Priorities' },
  ...PRIORITY_OPTIONS,
];
