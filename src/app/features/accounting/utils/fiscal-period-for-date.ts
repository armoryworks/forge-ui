import { FiscalPeriodModel, FiscalYearModel } from '../models/accounting.models';

/** The fiscal period whose start and end dates (inclusive, `YYYY-MM-DD`) contain `isoDate`, or null. */
export function fiscalPeriodForDate(years: FiscalYearModel[], isoDate: string | null): FiscalPeriodModel | null {
  if (!isoDate) return null;
  const day = isoDate.slice(0, 10);
  for (const year of years) {
    for (const period of year.periods) {
      if (period.startDate.slice(0, 10) <= day && day <= period.endDate.slice(0, 10)) return period;
    }
  }
  return null;
}
