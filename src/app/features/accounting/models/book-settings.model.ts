/** A book's maker-checker threshold (null = off) and reporting time zone — mirrors `BookSettingsModel`. */
export interface BookSettings {
  bookId: number;
  code: string;
  name: string;
  makerCheckerThreshold: number | null;
  reportingTimeZone: string;
  timeZoneLocked: boolean;
  companyTimeZone: string | null;
}
