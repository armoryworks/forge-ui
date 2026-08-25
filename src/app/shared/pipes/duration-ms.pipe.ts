import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formats a millisecond duration as a compact human-readable string, e.g.
 * `5400500` → `"1h 30m 500ms"`, `90000` → `"1m 30s"`, `250` → `"250ms"`.
 * Returns an empty string for null / non-positive values.
 */
@Pipe({ name: 'durationMs', standalone: true })
export class DurationMsPipe implements PipeTransform {
  transform(ms: number | null | undefined): string {
    if (ms == null || ms <= 0) return '';

    const hours = Math.floor(ms / 3_600_000);
    const minutes = Math.floor((ms % 3_600_000) / 60_000);
    const remainder = ms % 60_000;

    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (remainder > 0) {
      parts.push(remainder % 1000 === 0 ? `${remainder / 1000}s` : `${remainder}ms`);
    }
    return parts.join(' ');
  }
}
