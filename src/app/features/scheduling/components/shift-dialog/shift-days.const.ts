export const SHIFT_DAYS: readonly { flag: number; labelKey: string }[] = [
  { flag: 1, labelKey: 'scheduling.shiftDialog.days.mon' },
  { flag: 2, labelKey: 'scheduling.shiftDialog.days.tue' },
  { flag: 4, labelKey: 'scheduling.shiftDialog.days.wed' },
  { flag: 8, labelKey: 'scheduling.shiftDialog.days.thu' },
  { flag: 16, labelKey: 'scheduling.shiftDialog.days.fri' },
  { flag: 32, labelKey: 'scheduling.shiftDialog.days.sat' },
  { flag: 64, labelKey: 'scheduling.shiftDialog.days.sun' },
];

export const WEEKDAY_FLAGS = 1 | 2 | 4 | 8 | 16;

export function daysToFlags(days: readonly number[]): number {
  return days.reduce((mask, flag) => mask | flag, 0);
}

export function flagsToDays(mask: number): number[] {
  return SHIFT_DAYS.map(d => d.flag).filter(flag => (mask & flag) !== 0);
}
