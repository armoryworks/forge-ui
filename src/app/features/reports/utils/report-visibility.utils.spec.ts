import { describe, expect, it } from 'vitest';

import { isReportVisible, SHOP_REPORT_ROLES } from './report-visibility.utils';

describe('isReportVisible', () => {
  it('shows only the self-service reports to roles without shop-report access', () => {
    expect(isReportVisible('my-time-log', false)).toBe(true);
    expect(isReportVisible('my-work-history', false)).toBe(true);
    expect(isReportVisible('my-expense-history', false)).toBe(true);
    expect(isReportVisible('my-cycle-summary', false)).toBe(true);
    expect(isReportVisible('time-by-user', false)).toBe(false);
    expect(isReportVisible('simple-pnl', false)).toBe(false);
  });

  it('shows every report to roles with shop-report access', () => {
    expect(isReportVisible('simple-pnl', true)).toBe(true);
    expect(isReportVisible('my-time-log', true)).toBe(true);
  });

  it('keeps shop reports with the roles the reports route used to require', () => {
    expect(SHOP_REPORT_ROLES).toEqual(['Admin', 'Manager', 'PM']);
  });
});
