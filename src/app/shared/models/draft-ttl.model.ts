export interface DraftTtlOption {
  value: number;
  label: string;
}

export const DRAFT_TTL_OPTIONS: DraftTtlOption[] = [
  { value: 1 * 24 * 60 * 60 * 1000, label: '1 day' },
  { value: 3 * 24 * 60 * 60 * 1000, label: '3 days' },
  { value: 7 * 24 * 60 * 60 * 1000, label: '1 week' },
  { value: 14 * 24 * 60 * 60 * 1000, label: '2 weeks' },
];

export const DEFAULT_DRAFT_TTL = 7 * 24 * 60 * 60 * 1000;
