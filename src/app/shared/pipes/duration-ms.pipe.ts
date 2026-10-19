import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formats a millisecond duration as a compact human-readable string, e.g.
 * `5400500` → `"1h 30m 0.5s"`, `72000` → `"1m 12s"`, `8500` → `"8.5s"`, `250` → `"250ms"`.
 * The sub-minute remainder is shown in seconds with at most one decimal; milliseconds are
 * used only for a duration under one second. Returns an empty string for null / non-positive values.
 * With `'approx'` the value is an estimate: rounded to the minute, or to the hour from 100 hours up,
 * e.g. `5400500` → `"1h 30m"`, `1_212_330_000` → `"337h"`, and anything under a minute → `"<1m"`.
 */
@Pipe({ name: 'durationMs', standalone: true })
export class DurationMsPipe implements PipeTransform {
  transform(ms: number | null | undefined, mode: 'exact' | 'approx' = 'exact'): string {
    if (ms == null || ms <= 0) return '';
    if (mode === 'approx') return approximate(ms);
    if (Math.round(ms) < 1000) return `${Math.round(ms)}ms`;

    const tenths = Math.round(ms / 100);
    const hours = Math.floor(tenths / 36_000);
    const minutes = Math.floor((tenths % 36_000) / 600);
    const secondTenths = tenths % 600;

    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secondTenths > 0) parts.push(`${secondTenths / 10}s`);
    return parts.join(' ');
  }
}

function approximate(ms: number): string {
  const totalMinutes = Math.round(ms / 60_000);
  if (totalMinutes < 1) return '<1m';
  if (totalMinutes >= 100 * 60) return `${Math.round(totalMinutes / 60)}h`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  return parts.join(' ');
}
