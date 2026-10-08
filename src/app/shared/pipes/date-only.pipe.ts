import { Pipe, PipeTransform } from '@angular/core';

import { formatDate, fromIsoDate } from '../utils/date.utils';

/**
 * Formats a date-only value the API sends as UTC midnight (e.g. `"2026-10-30T00:00:00Z"`)
 * as `MM/dd/yyyy` on that same calendar day, in every timezone. The plain `date` pipe renders
 * such a value in local time, which shows the previous day west of UTC.
 * Returns an empty string for null / invalid values.
 */
@Pipe({ name: 'dateOnly', standalone: true })
export class DateOnlyPipe implements PipeTransform {
  transform(value: Date | string | null | undefined): string {
    const day = fromIsoDate(value);
    return day ? formatDate(day) : '';
  }
}
