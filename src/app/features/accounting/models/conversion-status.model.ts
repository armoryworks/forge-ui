/** §7A cutover state of one book — mirrors `ConversionStatusModel` (`GET accounting/conversion/status`). */
export interface ConversionStatus {
  bookId: number;
  bookName: string;
  functionalCurrencyId: number;
  openingJournalPosted: boolean;
  openingEntryId: number | null;
  openingEntryNumber: number | null;
  openingEntryDate: string | null;
  fullGlEnabled: boolean;
}
