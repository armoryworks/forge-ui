import { kpiChangeDirection } from './kpi-chip.component';

describe('kpiChangeDirection', () => {
  it('shows a rise as good where higher is better', () => {
    expect(kpiChangeDirection(3, true)).toBe('up');
    expect(kpiChangeDirection(-2, true)).toBe('down');
  });

  it('shows a rise as bad where lower is better, such as overdue jobs', () => {
    expect(kpiChangeDirection(4, false)).toBe('down');
    expect(kpiChangeDirection(-1, false)).toBe('up');
  });

  it('is neutral when nothing changed', () => {
    expect(kpiChangeDirection(0, true)).toBe('neutral');
    expect(kpiChangeDirection(0, false)).toBe('neutral');
  });
});
