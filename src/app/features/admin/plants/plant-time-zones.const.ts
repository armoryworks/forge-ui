const FALLBACK_TIME_ZONES: readonly string[] = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles',
  'America/Anchorage', 'Pacific/Honolulu', 'America/Mexico_City', 'America/Toronto', 'Europe/London', 'UTC',
];

/** IANA time zones offered for a plant: the browser's list when it has one, else a short North American set. */
export function plantTimeZones(): readonly string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  const zones = intl.supportedValuesOf?.('timeZone');
  return zones && zones.length > 0 ? zones : FALLBACK_TIME_ZONES;
}
