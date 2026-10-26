import { SelectOption } from '../components/select/select.component';

const FALLBACK_ZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles',
  'America/Anchorage', 'Pacific/Honolulu', 'America/Mexico_City', 'America/Toronto', 'Europe/London',
  'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney',
];

/**
 * IANA time-zone choices from the browser's own zone list (a short common list where the browser has none),
 * always including `current` so a saved zone stays selectable.
 */
export function timeZoneOptions(current?: string | null): SelectOption[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  const zones = new Set(intl.supportedValuesOf?.('timeZone') ?? FALLBACK_ZONES);
  zones.add('UTC');
  if (current) zones.add(current);
  return [...zones].sort().map((zone) => ({ value: zone, label: zone.replace(/_/g, ' ') }));
}
