import { convertToParamMap } from '@angular/router';

import {
  asOfForPreset,
  periodFromParams,
  presetForAsOf,
  presetForRange,
  rangeForPreset,
} from './statement-period';

describe('statement-period', () => {
  const today = new Date(2026, 9, 19);

  it('resolves range presets by calendar month and quarter', () => {
    expect(rangeForPreset('thisMonth', today)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(rangeForPreset('lastMonth', today)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(rangeForPreset('thisQuarter', today)).toEqual({ from: '2026-10-01', to: '2026-12-31' });
    expect(rangeForPreset('lastQuarter', today)).toEqual({ from: '2026-07-01', to: '2026-09-30' });
    expect(rangeForPreset('lastYear', today)).toEqual({ from: '2025-01-01', to: '2025-12-31' });
    expect(rangeForPreset('custom', today)).toBeNull();
  });

  it('leaves the start of year-to-date to the server fiscal year', () => {
    expect(rangeForPreset('yearToDate', today)).toEqual({ from: null, to: '2026-10-19' });
  });

  it('crosses the year boundary for last month and last quarter in January', () => {
    const jan = new Date(2026, 0, 15);
    expect(rangeForPreset('lastMonth', jan)).toEqual({ from: '2025-12-01', to: '2025-12-31' });
    expect(rangeForPreset('lastQuarter', jan)).toEqual({ from: '2025-10-01', to: '2025-12-31' });
  });

  it('resolves as-of presets', () => {
    expect(asOfForPreset('today', today)).toBe('2026-10-19');
    expect(asOfForPreset('endOfLastMonth', today)).toBe('2026-09-30');
    expect(asOfForPreset('endOfLastQuarter', today)).toBe('2026-09-30');
    expect(asOfForPreset('endOfLastYear', today)).toBe('2025-12-31');
  });

  it('matches a window back to its preset, else custom', () => {
    expect(presetForRange({ from: null, to: null }, today)).toBe('yearToDate');
    expect(presetForRange({ from: '2026-09-01', to: '2026-09-30' }, today)).toBe('lastMonth');
    expect(presetForRange({ from: '2026-09-02', to: '2026-09-30' }, today)).toBe('custom');
    expect(presetForAsOf(null, today)).toBe('today');
    expect(presetForAsOf('2025-12-31', today)).toBe('endOfLastYear');
    expect(presetForAsOf('2025-12-30', today)).toBe('custom');
  });

  it('reads the window from query params and drops malformed dates', () => {
    expect(periodFromParams(convertToParamMap({ from: '2026-01-01', to: '2026-03-31' })))
      .toEqual({ from: '2026-01-01', to: '2026-03-31' });
    expect(periodFromParams(convertToParamMap({ from: 'yesterday', to: '2026-3-1' })))
      .toEqual({ from: null, to: null });
  });
});
