/** Result of posting the opening-balance journal — mirrors `OpeningBalanceResult`. */
export interface OpeningBalanceResult {
  journalEntryId: number;
  entryNumber: number;
  totalDebit: number;
}
