import { zonedWallTimeToIso } from './zoned-date-time';

describe('zonedWallTimeToIso', () => {
  it('uses the zone offset in standard time', () => {
    expect(zonedWallTimeToIso(new Date(2026, 10, 2), '09:30', 'America/Denver')).toBe('2026-11-02T09:30:00-07:00');
  });

  it('uses the zone offset in daylight time', () => {
    expect(zonedWallTimeToIso(new Date(2026, 6, 15), '16:00', 'America/New_York')).toBe('2026-07-15T16:00:00-04:00');
  });

  it('handles zones ahead of UTC with half-hour offsets', () => {
    expect(zonedWallTimeToIso(new Date(2026, 0, 10), '08:00', 'Asia/Kolkata')).toBe('2026-01-10T08:00:00+05:30');
  });

  it('falls back to the browser zone without one', () => {
    const iso = zonedWallTimeToIso(new Date(2026, 0, 10), '08:00', null);
    expect(new Date(iso).getHours()).toBe(8);
  });
});
