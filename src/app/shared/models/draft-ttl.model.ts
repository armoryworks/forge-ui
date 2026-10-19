export interface DraftTtlOption {
  value: number;
  labelKey: string;
}

export const DRAFT_TTL_OPTIONS: DraftTtlOption[] = [
  { value: 1 * 24 * 60 * 60 * 1000, labelKey: 'account.draftRetention.oneDay' },
  { value: 3 * 24 * 60 * 60 * 1000, labelKey: 'account.draftRetention.threeDays' },
  { value: 7 * 24 * 60 * 60 * 1000, labelKey: 'account.draftRetention.oneWeek' },
  { value: 14 * 24 * 60 * 60 * 1000, labelKey: 'account.draftRetention.twoWeeks' },
];

export const DEFAULT_DRAFT_TTL = 7 * 24 * 60 * 60 * 1000;
