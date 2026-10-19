const DATE_ONLY_VALUE = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.0+)?(?:Z|[+-]00:?00))?$/;
const TIME_OF_DAY_VALUE = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d+)?)?$/;

/**
 * Parse a date-only string — `YYYY-MM-DD`, or the UTC midnight the API sends for date fields
 * (`2026-10-30T00:00:00Z` / `+00:00`) — to a local Date on that same calendar day.
 * Returns null for any other string, so callers fall back to normal parsing for real timestamps.
 */
export function parseDateOnly(value: string): Date | null {
  const m = DATE_ONLY_VALUE.exec(value.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

function toLocalDate(value: Date | string): Date {
  return typeof value === 'string' ? parseDateOnly(value) ?? new Date(value) : value;
}

/**
 * Resolve a value to a Date on the calendar day it stands for. A date-only string, or a Date at
 * exactly UTC midnight (how the API sends date fields), becomes local midnight of that UTC day;
 * any other value keeps its own local day. Used by toIsoDate()/toDateOnly() and the datepicker,
 * so a date-only value loaded with new Date(value) neither shows nor saves as the previous day.
 */
export function toCalendarDate(value: Date | string): Date {
  const d = toLocalDate(value);
  const isUtcMidnight = d.getUTCHours() === 0 && d.getUTCMinutes() === 0
    && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
  return isUtcMidnight && d.getHours() !== 0
    ? new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    : d;
}

export function toIsoDate(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  // Accept string (e.g. from localStorage draft restore) or Date
  const d = toCalendarDate(date);
  if (isNaN(d.getTime())) return null;
  // Send full ISO 8601 UTC string — Postgres timestamptz requires UTC kind
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}T00:00:00Z`;
}

/**
 * Convert a Date to date-only string (YYYY-MM-DD) for .NET DateOnly API fields.
 * Unlike toIsoDate(), this has no time component — required for APIs using DateOnly.
 */
export function toDateOnly(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const d = toCalendarDate(date);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Convert a date-only value the API sends as UTC midnight (e.g. "2026-10-30T00:00:00Z")
 * to a local Date on the same calendar day, for loading into a datepicker.
 * The inverse of toIsoDate(); new Date(value) would land on the previous day west of UTC.
 */
export function fromIsoDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return null;
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// ── Display format constants (project-wide standard) ──

/** Angular DatePipe format: MM/dd/yyyy (e.g., "03/11/2026") */
export const DATE_FORMAT = 'MM/dd/yyyy';

/** Angular DatePipe format: MM/dd/yyyy hh:mm a (e.g., "03/11/2026 02:30 PM") */
export const DATETIME_FORMAT = 'MM/dd/yyyy hh:mm a';

/** Format a Date for display: MM/dd/yyyy */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = toLocalDate(date);
  if (isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

/** Format a Date for display with time: MM/dd/yyyy hh:mm AM/PM */
export function formatDateTime(date: Date | string | number | null | undefined): string {
  const d = toTimestamp(date);
  return d ? `${monthDay(d)}/${d.getFullYear()} ${clockTime(d, false)}` : '';
}

/** Format a Date for display as month, day and time without the year: MM/dd hh:mm AM/PM */
export function formatDateTimeCompact(date: Date | string | number | null | undefined): string {
  const d = toTimestamp(date);
  return d ? `${monthDay(d)} ${clockTime(d, false)}` : '';
}

/**
 * Format the time of a Date for display: hh:mm AM/PM, or hh:mm:ss AM/PM with seconds.
 * Also accepts a time-of-day string as the API sends TimeOnly fields (`HH:mm` / `HH:mm:ss`).
 */
export function formatTime(date: Date | string | number | null | undefined, withSeconds = false): string {
  const timeOfDay = typeof date === 'string' ? TIME_OF_DAY_VALUE.exec(date.trim()) : null;
  const d = timeOfDay
    ? new Date(2000, 0, 1, Number(timeOfDay[1]), Number(timeOfDay[2]), Number(timeOfDay[3] ?? 0))
    : toTimestamp(date);
  return d ? clockTime(d, withSeconds) : '';
}

function toTimestamp(date: Date | string | number | null | undefined): Date | null {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  return isNaN(d.getTime()) ? null : d;
}

function monthDay(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function clockTime(d: Date, withSeconds: boolean): string {
  const h = d.getHours();
  const min = String(d.getMinutes()).padStart(2, '0');
  const sec = withSeconds ? `:${String(d.getSeconds()).padStart(2, '0')}` : '';
  return `${String(h % 12 || 12).padStart(2, '0')}:${min}${sec} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** Format a person's full name: Last, First MI */
export function formatFullName(firstName: string, lastName: string, middleInitial?: string): string {
  const mi = middleInitial ? ` ${middleInitial}` : '';
  return `${lastName}, ${firstName}${mi}`;
}

// ── Phase 1l Date-bound helpers ──
//
// These return a fresh Date each call so binding [min]/[max] to them in
// templates always reflects the current local date. Components that need
// real-time edge cases (midnight rollover within a long-lived form) should
// call these inside a `computed`; for typical CRUD dialogs, computing once
// at component init is sufficient.

/** Today at 00:00 local time — for [min] on future-only date pickers. */
export function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Today at 23:59:59 local time — for [max] on past-or-today pickers. */
export function todayEnd(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Reasonable [min] for date-of-birth: 120 years ago. */
export function dateOfBirthMin(): Date {
  const d = todayStart();
  d.setFullYear(d.getFullYear() - 120);
  return d;
}

/** Reasonable [max] for date-of-birth: 13 years ago (child-labor floor). */
export function dateOfBirthMax(): Date {
  const d = todayStart();
  d.setFullYear(d.getFullYear() - 13);
  return d;
}
