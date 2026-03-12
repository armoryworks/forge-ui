export function toIsoDate(date: Date | null | undefined): string | null {
  if (!date) return null;
  // Send full ISO 8601 UTC string — Postgres timestamptz requires UTC kind
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}T00:00:00Z`;
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
