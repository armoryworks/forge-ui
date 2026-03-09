export function toIsoDate(date: Date | null | undefined): string | null {
  if (!date) return null;
  // Send full ISO 8601 UTC string — Postgres timestamptz requires UTC kind
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}T00:00:00Z`;
}
