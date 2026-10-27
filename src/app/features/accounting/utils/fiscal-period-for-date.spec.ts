import { describe, expect, it } from 'vitest';

import { FiscalYearModel } from '../models/accounting.models';
import { fiscalPeriodForDate } from './fiscal-period-for-date';

const YEARS: FiscalYearModel[] = [{
  id: 1, name: 'FY2026', startDate: '2026-01-01', endDate: '2026-12-31', status: 'Open',
  periods: [
    { id: 11, fiscalYearId: 1, periodNumber: 1, name: 'Jan 2026', startDate: '2026-01-01', endDate: '2026-01-31', status: 'SoftClosed' },
    { id: 12, fiscalYearId: 1, periodNumber: 2, name: 'Feb 2026', startDate: '2026-02-01T00:00:00Z', endDate: '2026-02-28T00:00:00Z', status: 'Open' },
  ],
}];

describe('fiscalPeriodForDate', () => {
  it('finds the period whose inclusive range holds the date', () => {
    expect(fiscalPeriodForDate(YEARS, '2026-01-31T00:00:00Z')?.id).toBe(11);
    expect(fiscalPeriodForDate(YEARS, '2026-02-01')?.id).toBe(12);
  });

  it('returns null outside the calendar or without a date', () => {
    expect(fiscalPeriodForDate(YEARS, '2027-01-01')).toBeNull();
    expect(fiscalPeriodForDate(YEARS, null)).toBeNull();
  });
});
