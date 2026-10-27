/** Outcome of copying the company time zone onto books with no posted entry. */
export interface ApplyCompanyTimeZoneResult {
  timeZone: string;
  booksUpdated: number;
  booksLocked: number;
}
