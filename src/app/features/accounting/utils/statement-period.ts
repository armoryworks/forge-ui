import { ParamMap } from '@angular/router';

import { toDateOnly } from '../../../shared/utils/date.utils';

export type StatementPeriodMode = 'range' | 'asOf';

export type RangePreset = 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'lastQuarter' | 'yearToDate' | 'lastYear' | 'custom';
export type AsOfPreset = 'today' | 'endOfLastMonth' | 'endOfLastQuarter' | 'endOfLastYear' | 'custom';

export const RANGE_PRESETS: RangePreset[] = ['thisMonth', 'lastMonth', 'thisQuarter', 'lastQuarter', 'yearToDate', 'lastYear', 'custom'];
export const AS_OF_PRESETS: AsOfPreset[] = ['today', 'endOfLastMonth', 'endOfLastQuarter', 'endOfLastYear', 'custom'];

/** A statement window as `YYYY-MM-DD` strings; `from` is null for an as-of statement or a fiscal year-to-date default. */
export interface StatementPeriod {
  from: string | null;
  to: string | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const iso = (d: Date): string => toDateOnly(d) as string;
const validIso = (value: string | null): string | null => (value && ISO_DATE.test(value) ? value : null);

/** Reads the statement window from `?from=&to=` query params, ignoring malformed values. */
export function periodFromParams(params: ParamMap): StatementPeriod {
  return { from: validIso(params.get('from')), to: validIso(params.get('to')) };
}

/**
 * The window a range preset stands for, relative to `today`. Year-to-date leaves `from` null so the
 * server starts it at the fiscal year's first day (the fiscal year need not be the calendar year).
 */
export function rangeForPreset(preset: RangePreset, today: Date): StatementPeriod | null {
  const y = today.getFullYear();
  const m = today.getMonth();
  const q = Math.floor(m / 3) * 3;
  switch (preset) {
    case 'thisMonth':
      return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
    case 'lastMonth':
      return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    case 'thisQuarter':
      return { from: iso(new Date(y, q, 1)), to: iso(new Date(y, q + 3, 0)) };
    case 'lastQuarter':
      return { from: iso(new Date(y, q - 3, 1)), to: iso(new Date(y, q, 0)) };
    case 'yearToDate':
      return { from: null, to: iso(today) };
    case 'lastYear':
      return { from: iso(new Date(y - 1, 0, 1)), to: iso(new Date(y - 1, 11, 31)) };
    default:
      return null;
  }
}

/** The as-of date an as-of preset stands for, relative to `today`. */
export function asOfForPreset(preset: AsOfPreset, today: Date): string | null {
  const y = today.getFullYear();
  const m = today.getMonth();
  switch (preset) {
    case 'today':
      return iso(today);
    case 'endOfLastMonth':
      return iso(new Date(y, m, 0));
    case 'endOfLastQuarter':
      return iso(new Date(y, Math.floor(m / 3) * 3, 0));
    case 'endOfLastYear':
      return iso(new Date(y - 1, 11, 31));
    default:
      return null;
  }
}

/** The preset a window matches, else `custom`. An empty window is the year-to-date default. */
export function presetForRange(period: StatementPeriod, today: Date): RangePreset {
  if (!period.from && !period.to) return 'yearToDate';
  return RANGE_PRESETS.find((p) => {
    const r = rangeForPreset(p, today);
    return r !== null && r.from === period.from && r.to === period.to;
  }) ?? 'custom';
}

/** The preset an as-of date matches, else `custom`. An empty date is today. */
export function presetForAsOf(asOf: string | null, today: Date): AsOfPreset {
  if (!asOf) return 'today';
  return AS_OF_PRESETS.find((p) => asOfForPreset(p, today) === asOf) ?? 'custom';
}

/** Two windows are the same when both bounds match. */
export function samePeriod(a: StatementPeriod, b: StatementPeriod): boolean {
  return a.from === b.from && a.to === b.to;
}

/** The book a statement reads, from `?bookId=` (defaults to book 1). */
export function bookIdFromParams(params: ParamMap): number {
  const book = Number(params.get('bookId'));
  return book > 0 ? book : 1;
}
