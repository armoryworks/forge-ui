type PartType = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second';

function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant);
  const value = (type: PartType) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second'));
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60_000);
}

function pad(value: number): string {
  return String(Math.abs(value)).padStart(2, '0');
}

/**
 * The ISO-8601 timestamp, with the zone's UTC offset, for a wall-clock time on a calendar day in an IANA
 * time zone: `2026-11-02` + `09:30` in `America/Denver` → `2026-11-02T09:30:00-07:00`. Without a zone the
 * browser's own zone is used. Daylight-saving changes are honoured on the day itself.
 */
export function zonedWallTimeToIso(day: Date, time: string, timeZone: string | null): string {
  const [hours, minutes] = time.split(':').map(Number);
  const y = day.getFullYear();
  const m = day.getMonth();
  const d = day.getDate();
  const wall = Date.UTC(y, m, d, hours, minutes);
  let offset: number;
  if (timeZone) {
    offset = zoneOffsetMinutes(new Date(wall), timeZone);
    offset = zoneOffsetMinutes(new Date(wall - offset * 60_000), timeZone);
  } else {
    offset = -new Date(y, m, d, hours, minutes).getTimezoneOffset();
  }
  const sign = offset < 0 ? '-' : '+';
  return `${y}-${pad(m + 1)}-${pad(d)}T${pad(hours)}:${pad(minutes)}:00${sign}${pad(Math.trunc(offset / 60))}:${pad(offset % 60)}`;
}
