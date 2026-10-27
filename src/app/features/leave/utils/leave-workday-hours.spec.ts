import { leaveWorkdayHours } from './leave-workday-hours';

describe('leaveWorkdayHours', () => {
  it('counts weekdays only, both ends included', () => {
    expect(leaveWorkdayHours(new Date(2026, 10, 2), new Date(2026, 10, 2))).toBe(8);
    expect(leaveWorkdayHours(new Date(2026, 10, 6), new Date(2026, 10, 9))).toBe(16);
    expect(leaveWorkdayHours(new Date(2026, 10, 7), new Date(2026, 10, 8))).toBe(0);
  });

  it('is zero when the end is before the start', () => {
    expect(leaveWorkdayHours(new Date(2026, 10, 9), new Date(2026, 10, 2))).toBe(0);
  });
});
