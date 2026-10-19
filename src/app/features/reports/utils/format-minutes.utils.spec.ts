import { formatMinutesAsHours } from './format-minutes.utils';

describe('formatMinutesAsHours', () => {
  it('shows short entries instead of rounding them to zero', () => {
    expect(formatMinutesAsHours(2)).toBe('0:02');
  });

  it('carries whole hours and pads minutes', () => {
    expect(formatMinutesAsHours(95)).toBe('1:35');
    expect(formatMinutesAsHours(600)).toBe('10:00');
  });

  it('never shows a negative duration', () => {
    expect(formatMinutesAsHours(-5)).toBe('0:00');
  });
});
