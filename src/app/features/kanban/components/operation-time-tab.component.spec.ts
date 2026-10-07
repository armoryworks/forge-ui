import { describe, it, expect } from 'vitest';

import { OperationTimeTabComponent } from './operation-time-tab.component';

const formatMinutes = (minutes: number): string =>
  OperationTimeTabComponent.prototype.formatMinutes.call(null, minutes);

describe('OperationTimeTabComponent.formatMinutes', () => {
  it('shows estimates under a minute in seconds', () => {
    expect(formatMinutes(0)).toBe('0s');
    expect(formatMinutes(0.75)).toBe('45s');
    expect(formatMinutes(42 / 60)).toBe('42s');
  });

  it('shows estimates under an hour as minutes and padded seconds', () => {
    expect(formatMinutes(1)).toBe('1m 00s');
    expect(formatMinutes(2.5)).toBe('2m 30s');
    expect(formatMinutes(12 + 5 / 60)).toBe('12m 05s');
    expect(formatMinutes(59 + 59 / 60)).toBe('59m 59s');
  });

  it('keeps hours and minutes for an hour or more', () => {
    expect(formatMinutes(60)).toBe('1h 0m');
    expect(formatMinutes(135)).toBe('2h 15m');
    expect(formatMinutes(90.4)).toBe('1h 30m');
  });
});
