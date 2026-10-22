export function formatMinutesAsHours(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}
