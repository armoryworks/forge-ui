import { Pipe, PipeTransform } from '@angular/core';

import { formatDateTime, formatDateTimeCompact, formatTime } from '../utils/date.utils';

export type DateTimeStyle = 'full' | 'compact' | 'time' | 'timeSeconds';

/**
 * Formats a timestamp in local time on the project-wide 12-hour clock with AM/PM:
 * `full` (default) → `MM/dd/yyyy hh:mm a`, `compact` → `MM/dd hh:mm a`, `time` → `hh:mm a`,
 * `timeSeconds` → `hh:mm:ss a`. The time styles also accept a TimeOnly string (`HH:mm:ss`).
 * Use `dateOnly` for date-only fields.
 * Returns an empty string for null / invalid values.
 */
@Pipe({ name: 'dateTime', standalone: true })
export class DateTimePipe implements PipeTransform {
  transform(value: Date | string | number | null | undefined, style: DateTimeStyle = 'full'): string {
    switch (style) {
      case 'compact': return formatDateTimeCompact(value);
      case 'time': return formatTime(value);
      case 'timeSeconds': return formatTime(value, true);
      default: return formatDateTime(value);
    }
  }
}
