export function toIsoDate(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  // Accept string (e.g. from localStorage draft restore) or Date
  const d = typeof date === 'string' ? new Date(date) : date;
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
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── Display format constants (project-wide standard) ──

/** Angular DatePipe format: MM/dd/yyyy (e.g., "03/11/2026") */
export const DATE_FORMAT = 'MM/dd/yyyy';

/** Angular DatePipe format: MM/dd/yyyy hh:mm a (e.g., "03/11/2026 02:30 PM") */
export const DATETIME_FORMAT = 'MM/dd/yyyy hh:mm a';

/** Format a Date for display: MM/dd/yyyy */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

/** Format a Date for display with time: MM/dd/yyyy hh:mm AM/PM */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  let h = d.getHours();
  const min = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${mm}/${dd}/${yyyy} ${String(h).padStart(2, '0')}:${min} ${ampm}`;
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
